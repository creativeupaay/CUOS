import { v2 as cloudinary } from 'cloudinary';

// Simulate publicId with extension
const publicIdWithExt = 'identity-123.pdf';

console.log('1. ', cloudinary.url(publicIdWithExt, {
    secure: true, type: 'authenticated', sign_url: true, resource_type: 'image'
}));

console.log('2. format provided: ', cloudinary.url(publicIdWithExt, {
    secure: true, type: 'authenticated', sign_url: true, resource_type: 'image', format: 'pdf'
}));

// If publicId is clean
const publicIdClean = 'identity-123';
console.log('3. clean publicId: ', cloudinary.url(publicIdClean, {
    secure: true, type: 'authenticated', sign_url: true, resource_type: 'image'
}));
console.log('4. clean publicId + format: ', cloudinary.url(publicIdClean, {
    secure: true, type: 'authenticated', sign_url: true, resource_type: 'image', format: 'pdf'
}));
