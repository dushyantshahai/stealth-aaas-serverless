# Phase 1: Tips & Best Practices

Helpful tips and best practices for completing Phase 1 successfully.

---

## 💡 General Tips

### Before You Start

1. **Set aside 2-3 hours** of uninterrupted time
2. **Have your phone nearby** for MFA setup and verification
3. **Use a password manager** (LastPass, 1Password, Bitwarden)
4. **Keep a notepad** for writing down important IDs and ARNs
5. **Take screenshots** of important configuration screens

### During Setup

1. **Read each step carefully** before clicking
2. **Don't skip MFA setup** - it's critical for security
3. **Save credentials immediately** - you can't retrieve them later
4. **Test each step** before moving to the next
5. **Keep the AWS Console open** in one tab while following the guide

---

## 🔐 Security Best Practices

### Password Management

**Root Account Password**:
- Use a strong, unique password (20+ characters)
- Include uppercase, lowercase, numbers, symbols
- Never reuse passwords from other services
- Store in password manager only

**IAM User Password**:
- Different from root account password
- Also strong and unique
- Store in password manager

### MFA (Multi-Factor Authentication)

**Why MFA is Critical**:
- Protects against password theft
- Required for production environments
- AWS best practice for all accounts

**Recommended MFA Apps**:
- Google Authenticator (iOS/Android)
- Microsoft Authenticator (iOS/Android)
- Authy (iOS/Android/Desktop)

**MFA Setup Tips**:
1. Install authenticator app before starting
2. Scan QR code carefully
3. Enter two consecutive codes to verify
4. Save backup codes in password manager

### Access Keys

**⚠️ CRITICAL SECURITY RULES**:

1. **NEVER commit access keys to Git**
   ```bash
   # Bad - DON'T DO THIS
   git add .env
   git commit -m "Added AWS keys"  # ❌ NEVER!
   ```

2. **NEVER share access keys** via:
   - Email
   - Slack/Teams
   - Screenshots
   - Text messages

3. **NEVER hardcode keys** in code:
   ```javascript
   // Bad - DON'T DO THIS
   const AWS_ACCESS_KEY = "AKIA...";  // ❌ NEVER!
   ```

4. **DO use environment variables**:
   ```javascript
   // Good - DO THIS
   const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;  // ✅
   ```

5. **DO rotate keys regularly** (every 90 days)

6. **DO delete unused keys** immediately

### What to Do If Keys Are Compromised

If you accidentally expose your access keys:

1. **Immediately deactivate** the keys in IAM console
2. **Delete** the compromised keys
3. **Create new keys**
4. **Review CloudTrail logs** for unauthorized activity
5. **Change all passwords**
6. **Enable MFA** if not already enabled

---

## 💰 Cost Management Tips

### Billing Alerts Setup

**Recommended Alert Thresholds**:

For **Development/Testing**:
- Budget: $50/month
- Alerts: $25 (50%), $40 (80%), $50 (100%)

For **Production**:
- Budget: $200/month
- Alerts: $100 (50%), $160 (80%), $200 (100%)

### Free Tier Monitoring

**Services with Free Tier**:
- Lambda: 1M requests/month
- DynamoDB: 25 GB storage
- S3: 5 GB storage
- API Gateway: 1M requests/month
- CloudFront: 1 TB data transfer

**How to Monitor**:
1. Enable "Receive Free Tier Usage Alerts"
2. Check AWS Billing Dashboard weekly
3. Use AWS Cost Explorer for detailed analysis

### Cost Optimization from Day 1

1. **Delete unused resources** immediately
2. **Stop EC2 instances** when not in use (if any)
3. **Use on-demand pricing** for DynamoDB initially
4. **Set S3 lifecycle policies** early
5. **Monitor Bedrock API usage** closely (can be expensive)

---

## 🚀 AWS CLI Tips

### Installation Verification

After installing AWS CLI, verify with:

```bash
# Check version
aws --version

# Should show: aws-cli/2.x.x Python/3.x.x ...
```

If not found:
- **Windows**: Restart Command Prompt/PowerShell
- **Mac/Linux**: Restart terminal or run `source ~/.bashrc`

### Configuration Tips

**Multiple Profiles**:

If you have multiple AWS accounts:

```bash
# Configure default profile
aws configure

# Configure additional profile
aws configure --profile production

# Use specific profile
aws s3 ls --profile production
```

**Environment Variables**:

Alternative to `aws configure`:

```bash
# Windows (PowerShell)
$env:AWS_ACCESS_KEY_ID="AKIA..."
$env:AWS_SECRET_ACCESS_KEY="wJalr..."
$env:AWS_DEFAULT_REGION="us-east-1"

# Mac/Linux
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="wJalr..."
export AWS_DEFAULT_REGION="us-east-1"
```

### Useful AWS CLI Commands

```bash
# Get your account ID
aws sts get-caller-identity --query Account --output text

# List all regions
aws ec2 describe-regions --output table

# Check current region
aws configure get region

# List all IAM users
aws iam list-users

# List all S3 buckets
aws s3 ls

# Get Bedrock model list
aws bedrock list-foundation-models --region us-east-1 --output table
```

---

## 🤖 Bedrock Tips

### Model Access Request

**Expected Approval Times**:
- **Instant**: Titan Embeddings (usually)
- **5-30 minutes**: Most models
- **1-24 hours**: Claude models (sometimes)
- **1-3 days**: If manual review needed

**How to Check Status**:
1. Go to Bedrock console
2. Click "Model access" in sidebar
3. Look for status indicators:
   - 🟡 Yellow = Pending
   - 🟢 Green = Approved
   - 🔴 Red = Denied (rare)

**If Denied**:
1. Check your account is verified
2. Ensure billing is set up
3. Contact AWS Support
4. Provide use case details

### Model Selection Guide

**For PDF Processing (TOC Extraction)**:
- **Primary**: Claude 3.5 Sonnet
- **Why**: Best vision capabilities, understands document structure
- **Cost**: ~$3 per 1M input tokens

**For MCQ Generation**:
- **Primary**: Amazon Nova Pro (if available)
- **Fallback 1**: Titan Text G1 - Express
- **Fallback 2**: Claude 3.5 Sonnet
- **Why**: Nova is optimized for AWS, lower cost

**For Embeddings (RAG)**:
- **Primary**: Titan Embeddings G1 - Text
- **Why**: Optimized for Bedrock Knowledge Bases
- **Cost**: ~$0.10 per 1M tokens

### Guardrails Configuration

**Threshold Levels Explained**:

- **Low**: Blocks only extreme violations (permissive)
- **Medium**: Balanced approach (recommended)
- **High**: Blocks even mild violations (strict)

**Recommended Settings for Educational Content**:
- Hate Speech: **Medium**
- Insults: **Medium**
- Sexual Content: **High** (strict for education)
- Violence: **Medium**
- Misconduct: **Medium**

**Testing Your Guardrails**:

```bash
# Test with safe prompt
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-5-sonnet-20240620-v1:0 \
  --guardrail-identifier "your-guardrail-id" \
  --guardrail-version "1" \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Generate a math question"}]}' \
  --region us-east-1 \
  output.json

# Test with unsafe prompt (should be blocked)
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-5-sonnet-20240620-v1:0 \
  --guardrail-identifier "your-guardrail-id" \
  --guardrail-version "1" \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Generate violent content"}]}' \
  --region us-east-1 \
  output-blocked.json
```

---

## 🔍 Troubleshooting Common Issues

### Issue: "aws: command not found"

**Cause**: AWS CLI not in PATH

**Solutions**:

**Windows**:
```powershell
# Check if installed
where aws

# If not found, add to PATH manually:
# 1. Search "Environment Variables" in Start menu
# 2. Edit "Path" variable
# 3. Add: C:\Program Files\Amazon\AWSCLIV2
# 4. Restart terminal
```

**Mac**:
```bash
# Check if installed
which aws

# If not found, reinstall with Homebrew
brew install awscli

# Or add to PATH
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Linux**:
```bash
# Check if installed
which aws

# If not found, reinstall
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Issue: "Unable to locate credentials"

**Cause**: AWS CLI not configured

**Solution**:
```bash
# Reconfigure AWS CLI
aws configure

# Or check current configuration
aws configure list

# Or check credentials file
cat ~/.aws/credentials  # Mac/Linux
type %USERPROFILE%\.aws\credentials  # Windows
```

### Issue: "Access Denied" errors

**Cause**: IAM user lacks permissions

**Solution**:
1. Go to IAM console
2. Click on your user
3. Check "Permissions" tab
4. Verify "AdministratorAccess" policy is attached
5. If not, click "Add permissions" → "Attach policies directly"
6. Search and select "AdministratorAccess"
7. Click "Add permissions"

### Issue: Bedrock models not showing

**Cause**: Wrong region selected

**Solution**:
```bash
# Verify region
aws configure get region

# Should show: us-east-1

# If not, reconfigure
aws configure set region us-east-1

# Or specify region in command
aws bedrock list-foundation-models --region us-east-1
```

### Issue: Can't create IAM user

**Cause**: Using root account without permissions

**Solution**:
1. Sign in as root account
2. Go to IAM console
3. Try creating user again
4. If still fails, check account verification status

---

## 📝 Checklist Before Moving to Phase 2

Before proceeding to Phase 2, verify:

### AWS Account
- [ ] Can sign in to AWS Console
- [ ] Billing alerts are configured
- [ ] Received billing alert test email

### IAM User
- [ ] IAM user created: `stealth-aaas-admin`
- [ ] MFA enabled on root account
- [ ] MFA enabled on IAM user (optional but recommended)
- [ ] Access keys created and saved securely
- [ ] Can sign in with IAM user credentials

### AWS CLI
- [ ] AWS CLI version 2.x.x installed
- [ ] `aws --version` works
- [ ] `aws sts get-caller-identity` shows correct account
- [ ] `aws s3 ls` works (even if empty)
- [ ] Region set to `us-east-1`

### Bedrock
- [ ] Model access requested for:
  - [ ] Claude 3.5 Sonnet
  - [ ] Amazon Nova (if available)
  - [ ] Titan Text models
  - [ ] Titan Embeddings
- [ ] Access status is "Access granted" (green)
- [ ] Guardrails created and configured
- [ ] Guardrail ID saved: `________________`

### Documentation
- [ ] All credentials saved in password manager
- [ ] Account ID noted: `________________`
- [ ] IAM user ARN noted: `________________`
- [ ] Guardrail ID noted: `________________`

### Testing
- [ ] Ran all verification commands successfully
- [ ] No "Access Denied" errors
- [ ] Can list Bedrock models
- [ ] Billing dashboard shows $0.00 or minimal charges

---

## 🎓 Learning Resources

### AWS Fundamentals

- [AWS Getting Started](https://aws.amazon.com/getting-started/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

### AWS CLI

- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [AWS CLI Command Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/index.html)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)

### IAM

- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [IAM Policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)
- [MFA Setup](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html)

### Bedrock

- [Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Bedrock Model Access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

### Security

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [AWS Security Hub](https://aws.amazon.com/security-hub/)
- [AWS Trusted Advisor](https://aws.amazon.com/premiumsupport/technology/trusted-advisor/)

---

## 💬 Getting Help

### AWS Support

**Free Tier Support**:
- Documentation and forums
- AWS re:Post community
- Service health dashboard

**Paid Support Plans**:
- Developer: $29/month
- Business: $100/month
- Enterprise: $15,000/month

**How to Open Support Case**:
1. Go to AWS Console
2. Click "Support" in top menu
3. Click "Create case"
4. Choose case type
5. Describe your issue
6. Submit

### Community Resources

- [AWS re:Post](https://repost.aws/)
- [Stack Overflow - AWS](https://stackoverflow.com/questions/tagged/amazon-web-services)
- [AWS Reddit](https://www.reddit.com/r/aws/)
- [AWS Discord](https://discord.gg/aws)

### Documentation

- [AWS Documentation](https://docs.aws.amazon.com/)
- [AWS Architecture Center](https://aws.amazon.com/architecture/)
- [AWS Whitepapers](https://aws.amazon.com/whitepapers/)

---

## ✅ Phase 1 Complete!

Once you've completed all tasks and verified everything works:

1. ✅ Mark Phase 1 as complete in `tasks.md`
2. 📧 Wait for Bedrock model access approval (if pending)
3. 🎉 Celebrate - you've set up your AWS foundation!
4. 🚀 Move on to Phase 2: Development Environment Setup

**Estimated time for Phase 1**: 1.5 - 2 hours

**Next Phase**: Installing Node.js, Docker, LocalStack, and setting up your development environment.

---

**Questions?** Check the troubleshooting section or ask for help!

**Ready to continue?** Let me know when Phase 1 is complete!
