/**
 * Launches a Floating Document Picture-in-Picture Notification Toast window
 * that stays on top of external desktop applications like VS Code, styled strictly according to the CUOS design system.
 */
export async function showFloatingPipNotification(
    title: string,
    message: string,
    link?: string
): Promise<boolean> {
    if (
        typeof window === 'undefined' ||
        !('documentPictureInPicture' in window) ||
        !window.documentPictureInPicture
    ) {
        console.warn('[showFloatingPipNotification] Document Picture-in-Picture API is not supported in this browser.');
        return false;
    }

    try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
            width: 360,
            height: 160,
        });

        if (!pipWin) return false;

        pipWin.document.title = title || 'CUOS Notification';

        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.padding = '0';
        pipWin.document.body.style.backgroundColor = '#F8FAFC';
        pipWin.document.body.style.color = '#0F1C14';
        pipWin.document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        pipWin.document.body.style.overflow = 'hidden';
        pipWin.document.body.style.userSelect = 'none';

        pipWin.document.body.innerHTML = `
            <div style="padding: 14px; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #10B981; letter-spacing: 0.04em; text-transform: uppercase;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 99px; background-color: #10B981;"></span>
                            <span>CUOS NOTIFICATION</span>
                        </div>
                        <span style="font-size: 10.5px; font-weight: 500; color: #94A3B8;">Just now</span>
                    </div>
                    <div style="font-size: 14px; font-weight: 700; color: #0F1C14; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${title}
                    </div>
                    <div style="font-size: 12px; color: #475569; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                        ${message}
                    </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                    <button id="pip-dismiss-btn" style="padding: 5px 14px; font-size: 11.5px; font-weight: 600; background-color: #E2E8F0; color: #1E293B; border: none; border-radius: 99px; cursor: pointer;">
                        Dismiss
                    </button>
                    <button id="pip-open-btn" style="padding: 5px 16px; font-size: 11.5px; font-weight: 600; background-color: #10B981; color: #FFFFFF; border: none; border-radius: 99px; cursor: pointer; box-shadow: 0 2px 8px rgba(16,185,129,0.3);">
                        Open CUOS ↗
                    </button>
                </div>
            </div>
        `;

        const dismissBtn = pipWin.document.getElementById('pip-dismiss-btn');
        const openBtn = pipWin.document.getElementById('pip-open-btn');

        if (dismissBtn) {
            dismissBtn.onclick = () => pipWin.close();
        }
        if (openBtn) {
            openBtn.onclick = () => {
                try {
                    window.focus();
                } catch {
                    // Ignore focus error
                }
                if (link) {
                    window.location.href = link;
                }
                pipWin.close();
            };
        }

        setTimeout(() => {
            try {
                if (pipWin && !pipWin.closed) {
                    pipWin.close();
                }
            } catch {
                // Ignore close error
            }
        }, 10000);

        return true;
    } catch (err) {
        console.error('[showFloatingPipNotification] Error launching floating PiP window:', err);
        return false;
    }
}
