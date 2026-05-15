(function () {
    const currentPage = document.body.dataset.page;

    document.querySelectorAll(".menu a[data-nav]").forEach(function (link) {
        const isCurrent = link.dataset.nav === currentPage;
        link.classList.toggle("ativo", isCurrent);

        if (isCurrent) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}());
