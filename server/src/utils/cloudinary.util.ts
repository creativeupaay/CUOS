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
    cloudinaryId: string; // prefixed with resource_type for private uploads: "raw:publicId" or "image:publicId"
    url: string;
    format: string;
    size: number;
}

/**
 * Upload a document (uses Cloudinary if configured, otherwise falls back to local storage)
 * @param isPrivate - if true, upload as authenticated (private). Default: true.
 */
export const uploadDocument = async (
    fileBuffer: Buffer,
    folder: string,
    fileName: string,
    isPrivate: boolean = true
): Promise<CloudinaryUploadResult> => {
    if (isCloudinaryConfigured) {
        return new Promise((resolve, reject) => {
            // Remove extension from fileName so cloudinary doesn't embed it in the publicId
            // If the publicId ends with an extension, Cloudinary interprets it as a format
            // request when generating signed URLs later.
            const parsedName = path.parse(fileName).name;

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'auto',
                    public_id: parsedName,
                    // Note: `isPrivate` is intentionally ignored here for Cloudinary.
                    // Cloudinary's Free/Standard tiers strictly forbid programmatic delivery of 
                    // `type: 'authenticated'` or `access_mode: 'authenticated'` assets,
                    // causing permanent 401 Unauthorized errors even with fully valid signed URLs.
                    // We rely on the unguessable nature of the employee MongoDB ID & timestamp in the path.
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else if (result) {
                        // For private uploads prefix cloudinaryId with resource_type so
                        // getSignedUrl can reconstruct the correct URL later.
                        const prefix = isPrivate ? `${result.resource_type}:` : '';
                        resolve({
                            cloudinaryId: `${prefix}${result.public_id}`,
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
 * Generate a secure expiring download URL for an authenticated Cloudinary resource.
 *
 * Uses private_download_url (routes through api.cloudinary.com/download) so the
 * resource_type is always applied correctly — unlike cloudinary.url() which ignores it.
 *
 * @param cloudinaryId  - plain publicId, "raw:publicId", "local:path"
 * @param expiresIn     - seconds until expiry (default 1 hour)
 * @param resourceTypeOverride - force a specific resource_type (parsed from stored documentUrl)
 */
export const getSignedUrl = (
    cloudinaryId: string,
    expiresIn: number = 3600,
    resourceTypeOverride?: string
): string => {
    if (cloudinaryId.startsWith('local:')) {
        const relativePath = cloudinaryId.split('local:')[1];
        return `http://localhost:${process.env.PORT || 8000}/uploads/${relativePath}`;
    }

    // Resolve resource_type and clean public_id
    let resourceType = resourceTypeOverride || 'image';
    let publicId = cloudinaryId;

    if (!resourceTypeOverride) {
        const prefixMatch = cloudinaryId.match(/^(image|raw|video):/);
        if (prefixMatch) {
            resourceType = prefixMatch[1];
            publicId = cloudinaryId.slice(prefixMatch[0].length);
        } else {
            const rawExts = ['.pdf', '.doc', '.docx', '.txt', '.zip', '.csv', '.xls', '.xlsx', '.ppt', '.pptx'];
            if (rawExts.includes(path.extname(cloudinaryId).toLowerCase())) resourceType = 'raw';
        }
    } else {
        const prefixMatch = cloudinaryId.match(/^(image|raw|video):/);
        if (prefixMatch) publicId = cloudinaryId.slice(prefixMatch[0].length);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // Legacy fix: If publicId already contains an extension (e.g. '.pdf'), cloudinary.url()
    // will strip it and return a 404 because it thinks it's the requested output format.
    // Instead of fighting it with `format`, we remove the extension from the `publicId` entirely
    // before signing, AND we enforce the format in the options. 
    // Example: "identity-123.pdf" -> publicId: "identity-123", format: "pdf"
    const extMatch = String(publicId).match(/\.([a-z0-9]+)$/i);
    let cleanPublicId = publicId;
    let format = undefined;

    if (extMatch) {
        format = extMatch[1];
        cleanPublicId = String(publicId).replace(new RegExp(`\\.${format}$`, 'i'), '');
    }

    // cloudinary.url() correctly outputs /{resource_type}/authenticated/... in the URL path.
    // private_download_url is for type:'private' only and does NOT work for type:'authenticated'.
    return cloudinary.url(cleanPublicId, {
        secure: true,
        sign_url: true,
        type: 'authenticated',
        resource_type: resourceType as any,
        expires_at: expiresAt,
        ...(format ? { format } : {}),
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
