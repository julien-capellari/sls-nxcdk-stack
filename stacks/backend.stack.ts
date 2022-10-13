import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table';
import { ApiRouter, FileLambda } from '@neoxia/cdk-aws';
import { TerraformOutput, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';
import * as path from 'node:path';

// Types
export interface BackendOpts {
  stage: string;
  frontendUrl: string;
}

// Stack
export class BackendStack extends TerraformStack {
  constructor(scope: Construct, id: string, opts: BackendOpts) {
    super(scope, id);

    // Provider
    new AwsProvider(this, 'AWS', {
      region: 'eu-west-3',
      profile: 'nx-perso',
      defaultTags: {
        tags: {
          Project: 'sls-nxcdk-stack',
          Stage: opts.stage
        }
      }
    });

    // DynamoDB
    const table = new DynamodbTable(this, 'todos-table', {
      name: `todo-nxcdk-stack-${opts.stage}`,
      billingMode: 'PROVISIONED',
      readCapacity: 1,
      writeCapacity: 1,
      hashKey: 'id',

      attribute: [
        { name: 'id', type: 'S' },
      ],
    });

    // Lambda
    const lambdaApi = new FileLambda(this, 'LambdaApi', {
      functionName: `todos-api-nxcdk-stack-${opts.stage}`,
      runtime: 'nodejs16.x',
      handler: 'lambda.handler',
      filename: path.resolve(__dirname, '../backend/dist/lambda.zip'),

      environment: {
        TODO_TABLE: table.name,
      },

      tracingConfig: {
        mode: 'Active'
      }
    });

    lambdaApi.role.addStatement({
      Effect: "Allow",
      Action: ["dynamodb:Scan", "dynamodb:GetItem"],
      Resource: [table.arn],
    });

    // Api Router
    const api = new ApiRouter(this, 'Api', {
      name: `todos-api-nxcdk-stack-${opts.stage}`,
      defaultStage: { // TODO: add autoDeploy to defaults !
        autoDeploy: true,
      },
      routes: {
        '/{proxy+}': lambdaApi,
      },
      corsConfiguration: {
        allowOrigins: [opts.frontendUrl]
      }
    });

    new TerraformOutput(this, 'api-url', {
      value: api.gateway.apiEndpoint,
    });
  }
}
