import dotenv from 'dotenv';
dotenv.config({ path: '/Users/vinaykadel/PROJECTS/Creative Upaay /CUOS/server/.env' });

import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

import fs from 'fs';

async function main() {
    fs.writeFileSync('test.pdf', 'mock pdf content');

    try {
        console.log('Uploading as raw...');
        const rawRes = await cloudinary.uploader.upload('test.pdf', {
            resource_type: 'raw',
            public_id: 'test_raw_pdf',
            type: 'upload'
        });
        console.log('Raw URL:', rawRes.secure_url);

        const fetchRaw = await fetch(rawRes.secure_url);
        console.log('Fetch Raw Status:', fetchRaw.status);
    } catch (e: any) {
        console.error(e.message);
    }
}
main();
