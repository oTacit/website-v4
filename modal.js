(function () {
    const modal = document.getElementById("info-modal");

    if (!modal) {
        return;
    }

    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");
    const closeButton = modal.querySelector(".modal-close");
    let lastFocused = null;

    function openModal(trigger) {
        lastFocused = trigger;
        title.textContent = trigger.dataset.modalTitle || "Informacao";
        body.textContent = trigger.dataset.modalBody || "";
        modal.hidden = false;
        closeButton.focus();
    }

    function closeModal() {
        modal.hidden = true;

        if (lastFocused) {
            lastFocused.focus();
        }
    }

    document.querySelectorAll("[data-modal-title]").forEach(function (trigger) {
        trigger.addEventListener("click", function () {
            openModal(trigger);
        });
    });

    closeButton.addEventListener("click", closeModal);

    modal.addEventListener("click", function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });
}());
