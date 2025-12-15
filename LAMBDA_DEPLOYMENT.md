# Lambda Function Deployment Guide

## Current Status

The CloudWatch logs show the Lambda function `textract-finish-to-csv` is running, but **it doesn't include the new DEBUG logging** we added for credit card support. This means the deployed version is outdated.

## Deployment Steps

### Option 1: Deploy via AWS Console (Easiest)

1. **Create a ZIP file:**
   ```bash
   cd c:\Users\danie\Documents\airtable-dashboard
   # Windows PowerShell
   Compress-Archive -Path lambda_function.py -DestinationPath lambda_deployment.zip -Force
   ```

2. **Upload to AWS Lambda Console:**
   - Go to https://console.aws.amazon.com/lambda
   - Select function: `textract-finish-to-csv`
   - Click "Upload from" → ".zip file"
   - Upload `lambda_deployment.zip`
   - Click "Save"

### Option 2: Deploy via AWS CLI

```bash
cd c:\Users\danie\Documents\airtable-dashboard

# Create ZIP (Windows)
powershell Compress-Archive -Path lambda_function.py -DestinationPath lambda_deployment.zip -Force

# Upload to Lambda
aws lambda update-function-code ^
  --function-name textract-finish-to-csv ^
  --zip-file fileb://lambda_deployment.zip ^
  --region us-east-2
```

### Option 3: Deploy via Bun Script

Add this to your package.json:
```json
{
  "scripts": {
    "deploy:lambda": "bun run scripts/deploy-lambda.ts"
  }
}
```

Create `scripts/deploy-lambda.ts`:
```typescript
import { $ } from "bun";

// Create ZIP
await $`powershell Compress-Archive -Path lambda_function.py -DestinationPath lambda_deployment.zip -Force`;

// Upload to AWS
await $`aws lambda update-function-code --function-name textract-finish-to-csv --zip-file fileb://lambda_deployment.zip --region us-east-2`;

console.log("Lambda function deployed successfully!");
```

Then run:
```bash
bun run deploy:lambda
```

## Verify Deployment

After deploying, test the function and check CloudWatch logs for these new messages:

```
Retrieved metadata from s3://bucket/key: {...}
Processing with account_type=credit-card, account_number=941004
DEBUG: Checking account_type value: 'credit-card' (type: str)
DEBUG: Comparison result: account_type == 'credit-card' -> True
Using CREDIT CARD QBO format
Built credit card QBO with X transactions
```

## Testing

1. Upload a credit card statement via the web interface
2. Wait for processing
3. Check CloudWatch logs at: https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#logsV2:log-groups/log-group/$252Faws$252Flambda$252Ftextract-finish-to-csv

4. Verify the QBO file contains:
   ```xml
   <CREDITCARDMSGSRSV1>
     <CCSTMTTRNRS>
       <CCSTMTRS>
         <CCACCTFROM><ACCTID>941004</ACCTID></CCACCTFROM>
   ```

## Troubleshooting

### Issue: No DEBUG logs appear
**Cause:** Old version still deployed
**Fix:** Redeploy using steps above

### Issue: Still creates bank format for credit cards
**Cause:** Metadata not being set correctly in S3
**Fix:** Check that the Node.js backend is actually uploading with metadata:
```bash
aws s3api head-object --bucket your-bucket --key incoming/yourfile.pdf
```

Should show:
```json
{
  "Metadata": {
    "accounttype": "credit-card",
    "accountnumber": "941004"
  }
}
```

### Issue: Lambda timeout
**Current:** 8390ms (8.4 seconds)
**Max Memory:** 102 MB out of 128 MB allocated
**Fix:** If needed, increase timeout in Lambda configuration (currently seems fine)

## Next Steps

1. Deploy the updated Lambda function
2. Test with a credit card statement
3. Verify QBO output format
4. Check CloudWatch logs for DEBUG messages
