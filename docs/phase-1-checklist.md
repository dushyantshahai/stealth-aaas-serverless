# Phase 1: AWS Account Setup - Quick Checklist

Use this checklist to track your progress through Phase 1.

## Pre-requisites
- [ ] Valid email address
- [ ] Credit/debit card for AWS account
- [ ] Phone number for verification
- [ ] Password manager (recommended)

## Task 1.1: Create AWS Account
- [ ] Signed up at aws.amazon.com
- [ ] Verified email address
- [ ] Provided contact information
- [ ] Added payment method
- [ ] Verified identity via phone
- [ ] Selected Basic Support plan
- [ ] Received account activation email
- [ ] Successfully signed into AWS Console

**Time estimate**: 15-20 minutes

## Task 1.2: Set Up Billing Alerts
- [ ] Enabled billing preferences
- [ ] Enabled Free Tier usage alerts
- [ ] Created monthly budget ($50 or custom amount)
- [ ] Set up 50% budget alert
- [ ] Set up 80% budget alert
- [ ] Set up 100% budget alert
- [ ] Verified email notifications working

**Time estimate**: 10 minutes

## Task 1.3: Create IAM User
- [ ] Enabled MFA for root account
- [ ] Created IAM user: `stealth-aaas-admin`
- [ ] Attached AdministratorAccess policy
- [ ] Saved console credentials securely
- [ ] Created access keys for CLI
- [ ] Downloaded and saved access key CSV file
- [ ] Stored credentials in password manager

**Important**: Never share or commit access keys to Git!

**Time estimate**: 15 minutes

## Task 1.4: Install AWS CLI
- [ ] Downloaded AWS CLI installer for your OS
- [ ] Ran installer
- [ ] Verified installation: `aws --version`
- [ ] Confirmed version 2.x.x installed

**Time estimate**: 5-10 minutes

## Task 1.5: Configure AWS CLI
- [ ] Ran `aws configure`
- [ ] Entered Access Key ID
- [ ] Entered Secret Access Key
- [ ] Set region to `us-east-1`
- [ ] Set output format to `json`
- [ ] Tested with: `aws sts get-caller-identity`
- [ ] Verified account ID and user ARN displayed
- [ ] Tested S3 access: `aws s3 ls`
- [ ] Tested Lambda access: `aws lambda list-functions`

**Time estimate**: 5 minutes

## Task 1.6: Request Bedrock Model Access
- [ ] Navigated to Bedrock console
- [ ] Verified region is `us-east-1`
- [ ] Clicked "Model access" → "Manage model access"
- [ ] Selected Claude 3.5 Sonnet
- [ ] Selected Amazon Nova models (if available)
- [ ] Selected Titan Text models
- [ ] Selected Titan Embeddings G1 - Text
- [ ] Submitted access request
- [ ] Noted request submission time
- [ ] Saved Guardrail ID for later use

**Status check**: Return to Model access page to check approval status
- 🟡 Access requested (pending)
- 🟢 Access granted (ready!)

**Time estimate**: 10 minutes + waiting for approval (5 min - 24 hours)

## Task 1.7: Configure Bedrock Guardrails
- [ ] Created guardrail: `stealth-aaas-content-filter`
- [ ] Configured content filters (Hate, Insults, Sexual, Violence, Misconduct)
- [ ] Set thresholds to Medium
- [ ] Configured PII filters (Email, Phone, SSN, Credit Card, Address)
- [ ] Saved Guardrail ID: `_________________`
- [ ] Tested guardrail with sample prompts (optional)

**Time estimate**: 10 minutes

## Task 1.8: Verify Service Quotas
- [ ] Checked Lambda concurrent executions (1000)
- [ ] Checked API Gateway throttle rate (10,000/sec)
- [ ] Checked DynamoDB table limit (2,500)
- [ ] Checked Bedrock model quotas
- [ ] Requested quota increases if needed (optional)

**Time estimate**: 5 minutes

---

## Phase 1 Summary

**Total estimated time**: 1.5 - 2 hours (excluding Bedrock approval wait time)

### What You Should Have Now

1. ✅ AWS account with billing alerts
2. ✅ IAM user with admin access and MFA
3. ✅ AWS CLI installed and configured
4. ✅ Bedrock model access (pending or approved)
5. ✅ Bedrock Guardrails configured
6. ✅ Service quotas verified

### Important Information to Save

Create a secure note in your password manager with:

```
AWS Account Details
-------------------
Account ID: [Your 12-digit account ID]
Root Email: [Your root account email]
Region: us-east-1

IAM User
--------
Username: stealth-aaas-admin
Console URL: https://[account-id].signin.aws.amazon.com/console
Access Key ID: AKIA...
Secret Access Key: wJalrXUtn...

Bedrock
-------
Guardrail ID: [Your guardrail ID]
Models Requested: Claude 3.5 Sonnet, Nova, Titan Text, Titan Embeddings
Request Date: [Date you requested access]
```

### Verification Commands

Run these to verify everything is working:

```bash
# Verify AWS CLI configuration
aws sts get-caller-identity

# Verify region
aws configure get region

# List Bedrock models (once access is granted)
aws bedrock list-foundation-models --region us-east-1

# Check if you can access S3
aws s3 ls

# Check if you can access DynamoDB
aws dynamodb list-tables
```

### Common Issues and Solutions

**Issue**: `aws: command not found`
- **Solution**: Restart terminal or add AWS CLI to PATH

**Issue**: `Unable to locate credentials`
- **Solution**: Run `aws configure` again with correct access keys

**Issue**: `Access Denied` errors
- **Solution**: Verify IAM user has AdministratorAccess policy attached

**Issue**: Bedrock access not granted after 24 hours
- **Solution**: Open AWS Support case in console

**Issue**: Billing alerts not received
- **Solution**: Check spam folder, verify email in billing preferences

### Next Steps

Once Phase 1 is complete:

1. ✅ Mark all tasks as complete in tasks.md
2. 📧 Wait for Bedrock model access approval email
3. 🚀 Proceed to Phase 2: Development Environment Setup

---

**Questions or Issues?**

If you encounter any problems:
1. Check the troubleshooting section in `aws-setup-guide.md`
2. Review AWS documentation
3. Open an AWS Support case (if needed)
4. Ask for help in your team chat

**Ready to continue?** Let me know when Phase 1 is complete!
