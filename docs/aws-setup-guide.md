# AWS Account Setup Guide for Beginners

This guide will walk you through setting up your AWS account from scratch. Follow each step carefully.

---

## Table of Contents

1. [Create AWS Account](#step-1-create-aws-account)
2. [Set Up Billing Alerts](#step-2-set-up-billing-alerts)
3. [Create IAM User](#step-3-create-iam-user)
4. [Install AWS CLI](#step-4-install-aws-cli)
5. [Configure AWS CLI](#step-5-configure-aws-cli)
6. [Request Bedrock Model Access](#step-6-request-bedrock-model-access)
7. [Configure Bedrock Guardrails](#step-7-configure-bedrock-guardrails)
8. [Verify Service Quotas](#step-8-verify-service-quotas)

---

## Step 1: Create AWS Account

### 1.1 Sign Up for AWS

1. Go to [https://aws.amazon.com](https://aws.amazon.com)
2. Click **"Create an AWS Account"** (top right corner)
3. Enter your email address and choose an AWS account name
   - Example: `stealth-aaas-production`
4. Click **"Verify email address"**
5. Check your email and enter the verification code

### 1.2 Provide Account Information

1. Choose **"Personal"** or **"Business"** account type
   - For development/testing: Choose **Personal**
   - For production: Choose **Business**
2. Fill in your contact information:
   - Full name
   - Phone number
   - Country/Region
   - Address
3. Read and accept the AWS Customer Agreement
4. Click **"Continue"**

### 1.3 Add Payment Information

1. Enter your credit/debit card information
   - AWS requires a valid payment method even for free tier usage
   - You won't be charged unless you exceed free tier limits
2. Enter billing address
3. Click **"Verify and Add"**

### 1.4 Verify Your Identity

1. Choose verification method: **SMS** or **Voice call**
2. Enter your phone number
3. Enter the verification code you receive
4. Click **"Continue"**

### 1.5 Choose Support Plan

1. Select **"Basic Support - Free"** for now
   - You can upgrade later if needed
2. Click **"Complete sign up"**

### 1.6 Wait for Account Activation

- AWS will send you an email when your account is ready (usually within a few minutes)
- Once activated, you can sign in to the AWS Management Console

### 1.7 Sign In to AWS Console

1. Go to [https://console.aws.amazon.com](https://console.aws.amazon.com)
2. Click **"Sign in to the Console"**
3. Enter your root account email and password
4. You're now in the AWS Management Console!

**✅ Task 1.1 Complete: AWS account created**

---

## Step 2: Set Up Billing Alerts

It's crucial to set up billing alerts to avoid unexpected charges.

### 2.1 Enable Billing Alerts

1. In the AWS Console, click your account name (top right)
2. Click **"Account"** from the dropdown
3. Scroll down to **"Billing preferences"**
4. Click **"Edit"**
5. Check these boxes:
   - ✅ **"Receive PDF Invoice By Email"**
   - ✅ **"Receive Free Tier Usage Alerts"**
   - ✅ **"Receive Billing Alerts"**
6. Enter your email address
7. Click **"Update"**

### 2.2 Create Budget Alerts

1. In the search bar at the top, type **"Budgets"**
2. Click **"AWS Budgets"**
3. Click **"Create budget"**
4. Choose **"Use a template (simplified)"**
5. Select **"Monthly cost budget"**
6. Enter budget details:
   - **Budget name**: `Monthly-AWS-Budget`
   - **Budgeted amount**: `$50` (adjust based on your needs)
   - **Email recipients**: Your email address
7. Click **"Create budget"**

### 2.3 Set Up Cost Alerts

1. Create additional alerts for:
   - 50% of budget: `$25`
   - 80% of budget: `$40`
   - 100% of budget: `$50`
2. You'll receive emails when spending reaches these thresholds

**✅ Task 1.1 Complete: Billing alerts configured**

---

## Step 3: Create IAM User

**Important**: Never use your root account for daily operations. Create an IAM user instead.

### 3.1 Access IAM Console

1. In the AWS Console search bar, type **"IAM"**
2. Click **"IAM"** (Identity and Access Management)
3. You're now in the IAM Dashboard

### 3.2 Enable MFA for Root Account (Highly Recommended)

1. In the IAM Dashboard, look for **"Security recommendations"**
2. Click **"Add MFA for root user"**
3. Click **"Activate MFA"**
4. Choose **"Virtual MFA device"** (use Google Authenticator or Authy app)
5. Follow the setup wizard:
   - Open your authenticator app
   - Scan the QR code
   - Enter two consecutive MFA codes
6. Click **"Assign MFA"**

**✅ Root account now secured with MFA**

### 3.3 Create IAM User

1. In the left sidebar, click **"Users"**
2. Click **"Create user"**
3. Enter user details:
   - **User name**: `stealth-aaas-admin`
   - ✅ Check **"Provide user access to the AWS Management Console"**
   - Choose **"I want to create an IAM user"**
4. Click **"Next"**

### 3.4 Set Permissions

1. Choose **"Attach policies directly"**
2. Search and select these policies:
   - ✅ **AdministratorAccess** (for full access during development)
   
   **Note**: For production, you'll create more restrictive policies later

3. Click **"Next"**
4. Review and click **"Create user"**

### 3.5 Save User Credentials

1. **Important**: Download or copy the following:
   - Console sign-in URL
   - User name
   - Password (if auto-generated)
2. Click **"Download .csv file"** to save credentials
3. Store this file securely (use a password manager)

### 3.6 Create Access Keys for CLI

1. Click on the user you just created (`stealth-aaas-admin`)
2. Click the **"Security credentials"** tab
3. Scroll down to **"Access keys"**
4. Click **"Create access key"**
5. Choose **"Command Line Interface (CLI)"**
6. Check the confirmation box
7. Click **"Next"**
8. Add description: `Local development CLI access`
9. Click **"Create access key"**

### 3.7 Save Access Keys

**⚠️ CRITICAL**: You can only view the secret access key once!

1. Copy and save:
   - **Access key ID**: `AKIA...` (20 characters)
   - **Secret access key**: `wJalrXUtn...` (40 characters)
2. Click **"Download .csv file"**
3. Store this file securely (password manager or encrypted storage)
4. Click **"Done"**

**✅ Tasks 1.2 & 1.3 Complete: IAM user created with access keys**

---

## Step 4: Install AWS CLI

The AWS CLI allows you to interact with AWS services from your terminal.

### 4.1 For Windows

1. Download the AWS CLI installer:
   - Go to: [https://aws.amazon.com/cli/](https://aws.amazon.com/cli/)
   - Click **"Download for Windows"**
   - Or direct link: [AWS CLI MSI installer](https://awscli.amazonaws.com/AWSCLIV2.msi)

2. Run the downloaded `.msi` file
3. Follow the installation wizard:
   - Click **"Next"**
   - Accept the license agreement
   - Click **"Next"** → **"Install"**
   - Click **"Finish"**

4. Verify installation:
   - Open **Command Prompt** or **PowerShell**
   - Run: `aws --version`
   - You should see: `aws-cli/2.x.x Python/3.x.x Windows/...`

### 4.2 For macOS

**Option 1: Using Homebrew (Recommended)**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install AWS CLI
brew install awscli

# Verify installation
aws --version
```

**Option 2: Using the installer**
```bash
# Download and install
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version
```

### 4.3 For Linux

```bash
# Download the installer
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Unzip
unzip awscliv2.zip

# Install
sudo ./aws/install

# Verify installation
aws --version
```

**✅ Task 1.4 Complete: AWS CLI installed**

---

## Step 5: Configure AWS CLI

### 5.1 Run AWS Configure

Open your terminal and run:

```bash
aws configure
```

### 5.2 Enter Your Credentials

You'll be prompted for 4 pieces of information:

```
AWS Access Key ID [None]: AKIA................
AWS Secret Access Key [None]: wJalrXUtn...............................
Default region name [None]: us-east-1
Default output format [None]: json
```

**Enter**:
1. **Access Key ID**: Paste the access key from Step 3.7
2. **Secret Access Key**: Paste the secret key from Step 3.7
3. **Region**: `us-east-1` (as specified in requirements)
4. **Output format**: `json`

### 5.3 Verify Configuration

Test your AWS CLI configuration:

```bash
# Get your identity
aws sts get-caller-identity
```

**Expected output**:
```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/stealth-aaas-admin"
}
```

If you see this, your AWS CLI is configured correctly! ✅

### 5.4 Test Service Connectivity

```bash
# List S3 buckets (should return empty list if you have none)
aws s3 ls

# List Lambda functions (should return empty list)
aws lambda list-functions

# Check DynamoDB tables (should return empty list)
aws dynamodb list-tables
```

**✅ Tasks 1.5 & 1.6 Complete: AWS CLI configured and tested**

---

## Step 6: Request Bedrock Model Access

Amazon Bedrock requires explicit access requests for AI models.

### 6.1 Navigate to Bedrock Console

1. In AWS Console search bar, type **"Bedrock"**
2. Click **"Amazon Bedrock"**
3. **Important**: Verify you're in **us-east-1** region (top right corner)
   - If not, click the region dropdown and select **"US East (N. Virginia) us-east-1"**

### 6.2 Request Model Access

1. In the left sidebar, click **"Model access"**
2. Click **"Manage model access"** (orange button)
3. You'll see a list of available models

### 6.3 Request Access to Required Models

Check the boxes for these models:

#### ✅ **Anthropic Models**
- **Claude 3.5 Sonnet** (for PDF vision processing)
  - Model ID: `anthropic.claude-3-5-sonnet-20240620-v1:0`
  - Use case: PDF TOC extraction, MCQ generation fallback

#### ✅ **Amazon Nova Models** (if available)
- **Amazon Nova Pro** or **Amazon Nova Lite**
  - Use case: Primary MCQ generation

#### ✅ **Amazon Titan Models**
- **Titan Text G1 - Express** or **Titan Text G1 - Lite**
  - Use case: MCQ generation fallback
- **Titan Embeddings G1 - Text**
  - Use case: Document embeddings for RAG

### 6.4 Submit Access Request

1. After selecting models, scroll down
2. Click **"Request model access"**
3. You'll see a confirmation message

### 6.5 Wait for Approval

- **Approval time**: Usually 5 minutes to 24 hours
- **Check status**: Return to **"Model access"** page
- **Status indicators**:
  - 🟡 **"Access requested"** - Pending
  - 🟢 **"Access granted"** - Ready to use
  - 🔴 **"Access denied"** - Contact AWS support

### 6.6 Verify Model Access via CLI

Once approved, verify access:

```bash
# List available foundation models
aws bedrock list-foundation-models --region us-east-1

# Check specific model access
aws bedrock list-foundation-models \
  --by-provider anthropic \
  --region us-east-1
```

**Expected output**: JSON list of models you have access to

### 6.7 Test Model Invocation (Optional)

```bash
# Test Claude 3.5 Sonnet
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-5-sonnet-20240620-v1:0 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
  --region us-east-1 \
  output.json

# View response
cat output.json
```

**✅ Tasks 1.5 & 2.1-2.5 Complete: Bedrock model access requested and verified**

---

## Step 7: Configure Bedrock Guardrails

Guardrails help ensure AI-generated content is safe and appropriate.

### 7.1 Navigate to Guardrails

1. In Bedrock console, click **"Guardrails"** in left sidebar
2. Click **"Create guardrail"**

### 7.2 Configure Guardrail Details

1. **Guardrail name**: `stealth-aaas-content-filter`
2. **Description**: `Content safety filters for educational MCQ generation`
3. Click **"Next"**

### 7.3 Configure Content Filters

Enable these filters:

#### **Hate Speech**
- Threshold: **Medium**
- Action: **Block**

#### **Insults**
- Threshold: **Medium**
- Action: **Block**

#### **Sexual Content**
- Threshold: **High** (block only explicit content)
- Action: **Block**

#### **Violence**
- Threshold: **Medium**
- Action: **Block**

#### **Misconduct**
- Threshold: **Medium**
- Action: **Block**

Click **"Next"**

### 7.4 Configure Denied Topics (Optional)

Add topics to block:

1. Click **"Add denied topic"**
2. **Topic name**: `Personal Information`
3. **Definition**: `Any content requesting or containing personal identifiable information`
4. Click **"Add"**

Click **"Next"**

### 7.5 Configure Word Filters (Optional)

1. Add profanity filters if needed
2. Add custom blocked words
3. Click **"Next"**

### 7.6 Configure Sensitive Information Filters

Enable PII (Personally Identifiable Information) filters:

- ✅ **Email addresses** - Block
- ✅ **Phone numbers** - Block
- ✅ **Credit card numbers** - Block
- ✅ **Social security numbers** - Block
- ✅ **Addresses** - Block

Click **"Next"**

### 7.7 Review and Create

1. Review all settings
2. Click **"Create guardrail"**
3. Wait for creation (takes 1-2 minutes)
4. **Save the Guardrail ID**: `abc123xyz...`
   - You'll need this for Lambda functions

### 7.8 Test Guardrail (Optional)

1. Click on your guardrail
2. Click **"Test"** tab
3. Enter test prompts:
   - Safe prompt: `"Generate a math question about algebra"`
   - Unsafe prompt: `"Generate a question with violent content"`
4. Verify guardrail blocks unsafe content

**✅ Tasks 3.1-3.7 Complete: Bedrock Guardrails configured**

---

## Step 8: Verify Service Quotas

Check that you have sufficient service limits for the platform.

### 8.1 Navigate to Service Quotas

1. In AWS Console search bar, type **"Service Quotas"**
2. Click **"Service Quotas"**

### 8.2 Check Lambda Quotas

1. Click **"AWS services"**
2. Search for **"Lambda"**
3. Click **"AWS Lambda"**
4. Check these quotas:
   - **Concurrent executions**: Default is 1000 (sufficient for MVP)
   - **Function and layer storage**: Default is 75 GB (sufficient)

### 8.3 Check API Gateway Quotas

1. Go back to Service Quotas
2. Search for **"API Gateway"**
3. Check:
   - **Throttle rate**: Default is 10,000 requests/second (sufficient)
   - **Burst rate**: Default is 5,000 requests (sufficient)

### 8.4 Check DynamoDB Quotas

1. Search for **"DynamoDB"**
2. Check:
   - **Table limit**: Default is 2,500 tables per region (sufficient)
   - **Read/Write capacity**: On-demand mode has no limits

### 8.5 Check Bedrock Quotas

1. Search for **"Bedrock"**
2. Check:
   - **Model invocations per minute**: Varies by model
   - **Tokens per minute**: Varies by model
3. If you need higher limits, click **"Request quota increase"**

### 8.6 Request Quota Increases (If Needed)

If you expect high traffic:

1. Click on the quota you want to increase
2. Click **"Request quota increase"**
3. Enter:
   - **New quota value**: Your desired limit
   - **Use case description**: Brief explanation
4. Click **"Request"**
5. AWS will review (usually 1-2 business days)

**✅ Task 1.7 Complete: Service quotas verified**

---

## Phase 1 Complete! 🎉

You've successfully completed all Phase 1 tasks:

- ✅ AWS account created and configured
- ✅ Billing alerts set up
- ✅ IAM user created with MFA
- ✅ AWS CLI installed and configured
- ✅ Bedrock model access requested
- ✅ Bedrock Guardrails configured
- ✅ Service quotas verified

### What You Have Now

1. **AWS Account**: Fully configured and secured
2. **IAM User**: `stealth-aaas-admin` with admin access
3. **AWS CLI**: Configured and tested
4. **Bedrock Access**: Models requested (waiting for approval)
5. **Guardrails**: Content safety filters configured
6. **Billing Alerts**: Monitoring your AWS spending

### Important Files to Keep Secure

Store these securely (use a password manager):

1. **Root account credentials**
2. **IAM user credentials** (console password)
3. **AWS Access Keys** (Access Key ID + Secret Access Key)
4. **MFA device** (authenticator app)
5. **Guardrail ID**: `abc123xyz...`

### Next Steps

Once Bedrock model access is approved (check status in console):

1. **Proceed to Phase 2**: Development Environment Setup
2. **Install**: Node.js, Docker, LocalStack, SAM CLI
3. **Set up**: Project structure and dependencies

### Troubleshooting

**Problem**: AWS CLI not found after installation
- **Solution**: Restart your terminal or add AWS CLI to PATH

**Problem**: Access denied errors
- **Solution**: Verify IAM user has correct permissions

**Problem**: Bedrock access not granted after 24 hours
- **Solution**: Contact AWS Support via console

**Problem**: Billing alerts not working
- **Solution**: Verify email address and check spam folder

### Support Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **AWS Support**: https://console.aws.amazon.com/support/
- **AWS Free Tier**: https://aws.amazon.com/free/
- **Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/

---

**Ready for Phase 2?** Let me know when you've completed Phase 1 and we'll move on to setting up your development environment!
