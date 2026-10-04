import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetBucketPolicyCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
export class PrivateStorage {
  private readonly s3: S3Client;
  constructor(options: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  }) {
    this.s3 = new S3Client({
      region: "us-east-1",
      endpoint: `${options.useSSL ? "https" : "http"}://${options.endPoint}:${options.port}`,
      forcePathStyle: true,
      maxAttempts: 2,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
      requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
    });
  }
  async bucketExists(bucket: string) {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return false;
      throw error;
    }
  }
  async makeBucket(bucket: string) {
    await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  async getBucketPolicy(bucket: string) {
    try {
      return (
        (await this.s3.send(new GetBucketPolicyCommand({ Bucket: bucket })))
          .Policy || ""
      );
    } catch (error) {
      if ((error as Error).name === "NoSuchBucketPolicy") return "";
      throw error;
    }
  }
  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    size: number,
    headers: Record<string, string>,
  ) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: size,
        ContentType: headers["Content-Type"],
      }),
    );
  }
  async removeObject(bucket: string, key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  async getObject(bucket: string, key: string) {
    const result = await this.s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!(result.Body instanceof Readable))
      throw new Error("Expected a readable object stream");
    return result.Body;
  }
}
