(function () {
    const form = document.getElementById("message-form");
    const status = document.getElementById("form-status");
    const destination = "vitormgervazoni@gmail.com";

    if (!form) {
        return;
    }

    function buildBody(name, message) {
        return [
            "Nome: " + name,
            "",
            "Mensagem:",
            message
        ].join("\n");
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const data = new FormData(form);
        const name = String(data.get("name")).trim();
        const message = String(data.get("message")).trim();

        if (!name || !message) {
            status.textContent = "Preencha todos os campos antes de enviar.";
            return;
        }

        const subject = "Mensagem pelo Random Website";
        const body = buildBody(name, message);
        const mailto = "mailto:" + destination
            + "?subject=" + encodeURIComponent(subject)
            + "&body=" + encodeURIComponent(body);

        status.textContent = "Abrindo seu email para finalizar o envio.";
        window.location.href = mailto;
    });
}());
