import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
    cloudinaryId: string;
    url: string;
    format: string;
    size: number;
}

/**
 * Upload a document to Cloudinary
 * @param fileBuffer - File buffer to upload
 * @param folder - Cloudinary folder path
 * @param fileName - Original file name
 * @returns Upload result with cloudinary ID and metadata
 */
export const uploadDocument = async (
    fileBuffer: Buffer,
    folder: string,
    fileName: string
): Promise<CloudinaryUploadResult> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'auto',
                public_id: fileName,
                access_mode: 'authenticated', // Require authentication for access
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
};

/**
 * Generate a signed URL for secure document access
 * @param cloudinaryId - Cloudinary public ID
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL with expiration
 */
export const getSignedUrl = (
    cloudinaryId: string,
    expiresIn: number = 3600
): string => {
    const timestamp = Math.floor(Date.now() / 1000) + expiresIn;

    return cloudinary.url(cloudinaryId, {
        sign_url: true,
        type: 'authenticated',
        expires_at: timestamp,
    });
};

/**
 * Delete a document from Cloudinary
 * @param cloudinaryId - Cloudinary public ID
 */
export const deleteDocument = async (cloudinaryId: string): Promise<void> => {
    await cloudinary.uploader.destroy(cloudinaryId, {
        resource_type: 'auto',
    });
};

export default cloudinary;
