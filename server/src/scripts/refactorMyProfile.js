const fs = require('fs');
const filepath = '/Users/vinaykadel/PROJECTS/Creative Upaay /CUOS/client/src/pages/MyProfilePage.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Wrap the entire Header div line 352
content = content.replace(
    /\{\/\* ── Profile Header ──────────────────────────────────── \*\/\}\s+<div\s+className="rounded-xl border p-6 mb-6 flex items-center gap-5"\s+style=\{\{ borderColor: 'var\(--color-border-default\)', backgroundColor: 'var\(--color-bg-surface\)' \}\}\s+>/m,
    `{/* ── Profile Header ──────────────────────────────────── */}
            {!(isPartner && !isPartnerEmployee) && (
            <div
                className="rounded-xl border p-6 mb-6 flex items-center gap-5"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >`
);

// Close the header wrap just before '<div className="grid grid-cols-3 gap-5">'
content = content.replace(
    /<\/div>\s+<div className="grid grid-cols-3 gap-5">/m,
    `</div>\n            )}\n\n            <div className="grid grid-cols-3 gap-5">`
);

// 2. Hide Partner Owner from inner details
// First remove the old Partner header logic completely inside the header
content = content.replace(
    /\{isPartner && !isPartnerEmployee \? \([\s\S]*?\) : isPartnerEmployee \? \(/m,
    `{isPartnerEmployee ? (`
);

// Next remove the old Partner details block
content = content.replace(
    /\{isPartner && !isPartnerEmployee \? \([\s\S]*?\) : isPartnerEmployee \? \(/m,
    `{isPartnerEmployee ? (`
);

// Next remove the old Partner contact block
content = content.replace(
    /\{isPartner && !isPartnerEmployee \? \([\s\S]*?\) : isPartnerEmployee \? \(/m,
    `{isPartnerEmployee ? (`
);

// 3. Inject new Partner Component view just before the Grid block (or after the Header block)
const partnerTabsBlock = `
            {/* ── PARTNER TABS UI ──────────────────────────────────── */}
            {isPartner && !isPartnerEmployee && partnerInfo && (
                <div className="col-span-3 rounded-[28px] border bg-white shadow-sm mb-6" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div
                        className="flex flex-wrap gap-2 border-b px-4 pt-4"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F8FAFC' }}
                    >
                        {(['company', 'personal'] as const).map((key) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className="rounded-t-2xl px-5 py-3 text-sm font-semibold transition-all cursor-pointer"
                                style={
                                    tab === key
                                        ? {
                                            backgroundColor: 'white',
                                            color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-border-default)',
                                            borderBottomColor: 'white',
                                        }
                                        : {
                                            color: 'var(--color-text-secondary)',
                                            backgroundColor: 'transparent',
                                            border: '1px solid transparent',
                                        }
                                }
                            >
                                {key === 'company' ? 'Company Info' : 'Personal Info'}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 md:p-7">
                        {tab === 'company' && (
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                                <div className="rounded-3xl border p-6 text-center relative" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <div className="mx-auto flex h-40 w-full max-w-[220px] items-center justify-center overflow-hidden rounded-3xl border bg-white relative group" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {partnerInfo.companyLogo ? (
                                            <img src={partnerInfo.companyLogo} alt={partnerInfo.companyName || 'Company logo'} className="h-full w-full object-contain p-5" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <Building2 size={40} style={{ color: '#94A3B8' }} />
                                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No logo</span>
                                            </div>
                                        )}
                                        <button onClick={() => openImageModal('logo')} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <Camera className="text-white" size={24} />
                                        </button>
                                    </div>
                                    <p className="mt-5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                        {partnerInfo.companyName || 'Company name not added'}
                                    </p>
                                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {partnerInfo.websiteLink || 'Website not added yet'}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Company Details</h2>
                                          <button onClick={openPersonalModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}><Edit size={12}/> Edit Info</button>
                                     </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Company Name</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.companyName || '-'}</p></div>
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Website</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.websiteLink || '-'}</p></div>
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Contact Person</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.contactPerson || '-'}</p></div>
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Contact Person Phone</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.phone || partnerInfo.contactPersonPhone || '-'}</p></div>
                                        <div className="rounded-2xl border p-4 md:col-span-2"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Address</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{\`\${partnerInfo.address?.street || ''} \${partnerInfo.address?.state || ''} \${partnerInfo.address?.postalCode || ''}\`.trim() || '-'}</p></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'personal' && (
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                                <div className="rounded-3xl border p-6 text-center relative" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <div className="mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-3xl border bg-white relative group" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {partnerInfo.photo ? (
                                            <img src={partnerInfo.photo} alt={partnerInfo.contactPerson || 'Partner'} className="h-full w-full object-cover" />
                                        ) : (
                                            <UserCircle2 size={72} style={{ color: '#94A3B8' }} />
                                        )}
                                        <button onClick={() => openImageModal('photo')} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <Camera className="text-white" size={24} />
                                        </button>
                                    </div>
                                    <p className="mt-5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                        {partnerInfo.contactPerson || partnerInfo.userId?.name || 'Name not available'}
                                    </p>
                                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {partnerInfo.email || partnerInfo.userId?.email || 'No email added'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Personal Details</h2>
                                          <button onClick={openPersonalModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}><Edit size={12}/> Edit Info</button>
                                     </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Primary Name</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.userId?.name || partnerInfo.contactPerson || '-'}</p></div>
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Primary Email</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.userId?.email || partnerInfo.email || '-'}</p></div>
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Partner Phone</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.phone || partnerInfo.contactPersonPhone || '-'}</p></div>
                                        <div className="rounded-2xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Contact Person</p><p className="mt-2 text-sm font-medium break-words text-gray-900">{partnerInfo.contactPerson || '-'}</p></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
`;
content = content.replace(
    /<div className="grid grid-cols-3 gap-5">/m,
    partnerTabsBlock + '\n            {isPartner && !isPartnerEmployee ? null : (\n            <div className="grid grid-cols-3 gap-5">'
);

// We must securely close the <div className="grid grid-cols-3 gap-5"> block since we opened a React conditional around it.
// The block closes just before {/* ── Personal Info Modal ──────────────────────────────── */}
content = content.replace(
    /\{\/\* ── Personal Info Modal ──────────────────────────────── \*\/\}/m,
    `            )}\n\n            {/* ── Personal Info Modal ──────────────────────────────── */}`
);

// 4. Inject Image Modal right before the ending </div> of the component (or after Bank Details modal)
const imageModalCode = `
            {/* ── Image Update Modal ────────────────────────────────── */}
            {(activeModal === 'logo' || activeModal === 'photo') && (
                <ModalPortal>
                    <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit {activeModal === 'logo' ? 'Company Logo' : 'Profile Photo'}
                            </h2>
                            <button onClick={() => setActiveModal(null)}
                                className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveImage} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5"
                                    style={{ color: 'var(--color-text-secondary)' }}>
                                    Image URL (Link)
                                </label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://example.com/logo.png"
                                    value={imageForm.url}
                                    onChange={e => setImageForm({ ...imageForm, url: e.target.value })}
                                    className={inputCls}
                                    style={inputStyle}
                                />
                                <p className="text-xs text-gray-500 mt-2">Provide a direct link to an image (PNG, JPG, WEBP). It will be fetched securely by your browser.</p>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" disabled={isSaving}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setActiveModal(null)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}

`;
// Replace the final closing div and export. The file might end with "</div>\n    );\n}\n"
content = content.replace(
    /<\/div>\n    \);\n}\n[\s\S]*$/,
    imageModalCode
);

fs.writeFileSync(filepath, content);
// console.log('Refactoring complete!');
