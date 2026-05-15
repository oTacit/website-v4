(function () {
    const sequence = [
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a"
    ];

    let progress = 0;

    const overlay = document.createElement("div");
    overlay.className = "system-overlay";

    const box = document.createElement("section");
    box.className = "system-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "system-title");

    const title = document.createElement("h2");
    title.id = "system-title";
    title.textContent = "Easter egg encontrado.";

    const intro = document.createElement("p");
    intro.textContent = "Código Konami real ativado.";

    const detail = document.createElement("p");
    detail.textContent = "Confissão honesta sobre a criação do site:";

    const bar = document.createElement("div");
    bar.className = "system-bar";

    const human = document.createElement("div");
    human.className = "system-bar-human";
    human.textContent = "70% humano";

    const ai = document.createElement("div");
    ai.className = "system-bar-ai";
    ai.textContent = "30% IA";

    const split = document.createElement("p");
    split.className = "system-split";
    split.textContent = "70% humano, 30% IA.";

    const close = document.createElement("button");
    close.className = "system-close";
    close.type = "button";
    close.textContent = "Fechar";

    bar.append(human, ai);
    box.append(title, intro, detail, bar, split, close);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function normalizeKey(event) {
        if (event.key.length === 1) {
            return event.key.toLowerCase();
        }
        return event.key;
    }

    function openPopup() {
        overlay.classList.add("show");
        close.focus();
    }

    function closePopup() {
        overlay.classList.remove("show");
        progress = 0;
    }

    close.addEventListener("click", closePopup);

    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
            closePopup();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (overlay.classList.contains("show")) {
            if (event.key === "Escape") {
                closePopup();
            }
            return;
        }

        const pressed = normalizeKey(event);
        const expected = sequence[progress];

        if (pressed === expected) {
            progress += 1;

            if (progress === sequence.length) {
                openPopup();
                progress = 0;
            }

            return;
        }

        progress = pressed === sequence[0] ? 1 : 0;
    });
}());
