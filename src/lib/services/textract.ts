import {
  TextractClient,
  AnalyzeDocumentCommand,
  DetectDocumentTextCommand,
  Block,
} from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

// ─── Upload file buffer to S3 ───────────────────────────────
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

// ─── Generate a presigned URL for secure client-side viewing ─
export async function getPresignedUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// ─── Extract all text from a document in S3 ─────────────────
export async function extractTextFromS3(s3Key: string): Promise<string> {
  const command = new DetectDocumentTextCommand({
    Document: {
      S3Object: { Bucket: BUCKET, Name: s3Key },
    },
  });

  const response = await textractClient.send(command);
  const blocks: Block[] = response.Blocks || [];

  // Reconstruct text: join LINE blocks in order
  const lines = blocks
    .filter((b) => b.BlockType === 'LINE')
    .sort((a, b) => {
      const pageA = a.Page ?? 0;
      const pageB = b.Page ?? 0;
      if (pageA !== pageB) return pageA - pageB;
      const topA = a.Geometry?.BoundingBox?.Top ?? 0;
      const topB = b.Geometry?.BoundingBox?.Top ?? 0;
      return topA - topB;
    })
    .map((b) => b.Text ?? '')
    .filter(Boolean);

  return lines.join('\n');
}

// ─── Analyze key-value pairs (forms) ────────────────────────
export async function analyzeFormFromS3(
  s3Key: string
): Promise<Record<string, string>> {
  const command = new AnalyzeDocumentCommand({
    Document: {
      S3Object: { Bucket: BUCKET, Name: s3Key },
    },
    FeatureTypes: ['FORMS'],
  });

  const response = await textractClient.send(command);
  const blocks: Block[] = response.Blocks || [];

  const keyMap: Record<string, Block> = {};
  const valueMap: Record<string, Block> = {};
  const relationships: Record<string, string[]> = {};

  blocks.forEach((b) => {
    if (b.Id) {
      if (b.BlockType === 'KEY_VALUE_SET') {
        if (b.EntityTypes?.includes('KEY')) keyMap[b.Id] = b;
        if (b.EntityTypes?.includes('VALUE')) valueMap[b.Id] = b;
        b.Relationships?.forEach((r) => {
          if (r.Ids) relationships[b.Id!] = r.Ids;
        });
      }
    }
  });

  const getText = (block: Block): string => {
    const childIds = block.Relationships?.find((r) => r.Type === 'CHILD')?.Ids || [];
    return childIds
      .map((id) => blocks.find((b) => b.Id === id))
      .filter(Boolean)
      .map((b) => b!.Text ?? '')
      .join(' ')
      .trim();
  };

  const result: Record<string, string> = {};
  Object.values(keyMap).forEach((keyBlock) => {
    const keyText = getText(keyBlock);
    const valueIds = relationships[keyBlock.Id!] || [];
    const valueBlock = valueIds.map((id) => valueMap[id]).find(Boolean);
    if (keyText && valueBlock) {
      result[keyText] = getText(valueBlock);
    }
  });

  return result;
}
