import {
    FileText,
    FileImage,
    FileVideo,
    FileArchive,
    FileCode,
    FileSpreadsheet,
    FilePenLine,
    File
} from 'lucide-react';

export interface FileIconProps {
    mimeType: string;
    size?: number;
    className?: string;
}

export function FileIcon({ mimeType, size = 20, className = '' }: FileIconProps) {
    if (mimeType.startsWith('image/')) return <FileImage size={size} className={className} />;
    if (mimeType.startsWith('video/')) return <FileVideo size={size} className={className} />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <FileSpreadsheet size={size} className={className} />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FilePenLine size={size} className={className} />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('archive')) return <FileArchive size={size} className={className} />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html')) return <FileCode size={size} className={className} />;
    if (mimeType.startsWith('text/')) return <FileText size={size} className={className} />;
    return <File size={size} className={className} />;
}
