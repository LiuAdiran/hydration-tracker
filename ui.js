class AppUI {
    static toast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `app-toast app-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 20);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 250);
        }, 2600);
    }

    static confirm(message, onConfirm, confirmText = '确认') {
        const modalId = `app-confirm-${Date.now()}`;
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">请确认操作</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-0">${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-danger" id="${modalId}-confirm">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalWrapper);

        const modalElement = document.getElementById(modalId);
        const confirmBtn = document.getElementById(`${modalId}-confirm`);
        const modal = new bootstrap.Modal(modalElement);

        const cleanup = () => {
            modalElement.removeEventListener('hidden.bs.modal', cleanup);
            modal.dispose();
            modalWrapper.remove();
        };

        confirmBtn.addEventListener('click', () => {
            onConfirm();
            modal.hide();
        });

        modalElement.addEventListener('hidden.bs.modal', cleanup);
        modal.show();
    }
}

window.AppUI = AppUI;
