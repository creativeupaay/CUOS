import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Define the fallback uploads path at the server root
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
} else {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
}

export interface CloudinaryUploadResult {
    cloudinaryId: string;
    url: string;
    format: string;
    size: number;
}

/**
 * Upload a document (uses Cloudinary if configured, otherwise falls back to local storage)
 */
export const uploadDocument = async (
    fileBuffer: Buffer,
    folder: string,
    fileName: string
): Promise<CloudinaryUploadResult> => {
    if (isCloudinaryConfigured) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'auto',
                    public_id: fileName,
                    access_mode: 'authenticated',
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else if (result) {
                        resolve({
                            cloudinaryId: result.public_id,
                            url: result.secure_url,
                            format: result.format,
                            size: result.bytes,
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(fileBuffer);
        });
    } else {
        // Fallback Local Disk Storage
        const format = path.extname(fileName).substring(1) || 'bin';
        const targetDir = path.join(UPLOADS_DIR, folder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`;
        const filePath = path.join(targetDir, uniqueName);

        await fs.promises.writeFile(filePath, fileBuffer);

        const relativePath = path.join(folder, uniqueName).replace(/\\/g, '/');

        return {
            cloudinaryId: `local:${relativePath}`,
            url: `http://localhost:${process.env.PORT || 8000}/uploads/${relativePath}`,
            format,
            size: fileBuffer.length,
        };
    }
};

/**
 * Generate a signed URL for secure document access (mocked for local)
 */
export const getSignedUrl = (
    cloudinaryId: string,
    expiresIn: number = 3600
): string => {
    if (cloudinaryId.startsWith('local:')) {
        const relativePath = cloudinaryId.split('local:')[1];
        return `http://localhost:${process.env.PORT || 8000}/uploads/${relativePath}`;
    }

    const timestamp = Math.floor(Date.now() / 1000) + expiresIn;
    return cloudinary.url(cloudinaryId, {
        sign_url: true,
        type: 'authenticated',
        expires_at: timestamp,
    });
};

/**
 * Delete a document from Cloudinary (or Local File System)
 */
export const deleteDocument = async (cloudinaryId: string): Promise<void> => {
    if (cloudinaryId.startsWith('local:')) {
        const relativePath = cloudinaryId.split('local:')[1];
        const filePath = path.join(UPLOADS_DIR, relativePath);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
        return;
    }

    await cloudinary.uploader.destroy(cloudinaryId, {
        resource_type: 'auto',
    });
};

export default cloudinary;
