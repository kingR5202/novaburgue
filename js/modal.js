// ============================================================
// MODAL DE SELEÇÃO DE OPÇÕES — Império do Burgão
// ============================================================
(function () {
    'use strict';

    // Estado do modal
    let currentProduct = null;
    let drinkSelections = {}; // { drinkId: qty }

    // ============================================================
    // HELPER: Formatar preço
    // ============================================================
    function formatPrice(cents) {
        return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
    }

    // ============================================================
    // ENCONTRAR PRODUTO PELO ID
    // ============================================================
    function findProductById(id) {
        return PRODUTOS.find(p => p.id === parseInt(id));
    }

    // ============================================================
    // TOTAL DE BEBIDAS SELECIONADAS
    // ============================================================
    function totalDrinks() {
        return Object.values(drinkSelections).reduce((sum, qty) => sum + qty, 0);
    }

    // ============================================================
    // ABRIR MODAL DE PRODUTO
    // ============================================================
    function openProductModal(product) {
        currentProduct = product;
        drinkSelections = {};

        const old = document.getElementById('modal-product-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'modal-product-overlay';
        overlay.className = 'modal-overlay';



        overlay.innerHTML = `
            <div class="modal-product">
                <button class="modal-back-btn" id="modal-back">VOLTAR</button>
                <img class="modal-product-image" src="${product.imagem}" alt="${product.nome}">
                <div class="modal-body-scroll">
                    <h2 class="modal-product-name">${product.nome}</h2>
                    <div class="modal-product-prices">
                        ${product.precoOriginal ? `<span class="modal-price-label">de</span> <span class="modal-price-original">${formatPrice(product.precoOriginal)}</span> <span class="modal-price-label">por</span>` : ''}
                    </div>
                    <div class="modal-price-current">${formatPrice(product.preco)}</div>
                    <div class="modal-product-stock">🔥 <b>Restam poucas unidades</b></div>

                    <h3 class="modal-section-title">Descrição</h3>
                    <p class="modal-product-description">${product.descricao}</p>

                    <!-- SELEÇÃO DE REFRIGERANTES -->
                    <div class="modal-drinks-header">
                        <div class="modal-drinks-header-left">
                            <h3>Escolha seu refrigerantes:</h3>
                            <p>Escolha até ${product.maxBebidas} opções</p>
                        </div>
                        <div class="modal-drinks-counter-badge">
                            <span id="drinks-count">0/${product.maxBebidas}</span>
                            <div class="badge-ok" id="drinks-badge-ok">✓</div>
                        </div>
                    </div>
                    <ul class="modal-drink-list">
                        ${BEBIDAS_DISPONIVEIS.map(drink => `
                            <li class="modal-drink-item" data-drink-id="${drink.id}">
                                <img class="modal-drink-img" src="${drink.imagem}" alt="${drink.nome}">
                                <span class="modal-drink-name">${drink.nome}</span>
                                <div class="modal-drink-controls">
                                    <button class="drink-minus" data-drink="${drink.id}">−</button>
                                    <span class="modal-drink-qty" id="qty-${drink.id}">0</span>
                                    <button class="drink-plus" data-drink="${drink.id}">+</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>

                    <!-- OBSERVAÇÃO -->
                    <div class="modal-obs-section">
                        <h3>Adicionar algum detalhe?</h3>
                        <textarea class="modal-obs-textarea" id="modal-obs" placeholder="Escreva o detalhe aqui..." maxlength="140"></textarea>
                        <div class="modal-obs-count"><span id="obs-char-count">0</span>/140</div>
                    </div>
                </div>

                <!-- RODAPÉ FIXO -->
                <div class="modal-footer-fixed">
                    <span class="modal-footer-price" id="modal-total-price">${formatPrice(product.preco)}</span>
                    <button class="modal-footer-btn" id="modal-add-cart">Adicionar ao carrinho</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add('active'));
        });

        setupModalEvents(overlay, product);
    }

    // ============================================================
    // CONFIGURAR EVENTOS DO MODAL
    // ============================================================
    function setupModalEvents(overlay, product) {
        overlay.querySelector('#modal-back').addEventListener('click', () => closeModal(overlay));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });

        overlay.querySelectorAll('.drink-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const drinkId = btn.dataset.drink;
                const current = drinkSelections[drinkId] || 0;
                if (totalDrinks() < product.maxBebidas) {
                    drinkSelections[drinkId] = current + 1;
                    updateDrinkUI(overlay, product);
                }
            });
        });

        overlay.querySelectorAll('.drink-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const drinkId = btn.dataset.drink;
                const current = drinkSelections[drinkId] || 0;
                if (current > 0) {
                    drinkSelections[drinkId] = current - 1;
                    if (drinkSelections[drinkId] === 0) delete drinkSelections[drinkId];
                    updateDrinkUI(overlay, product);
                }
            });
        });

        const obsTextarea = overlay.querySelector('#modal-obs');
        const obsCount = overlay.querySelector('#obs-char-count');
        obsTextarea.addEventListener('input', () => {
            obsCount.textContent = obsTextarea.value.length;
        });

        // ADICIONAR AO CARRINHO → salvar e ir para página do carrinho
        overlay.querySelector('#modal-add-cart').addEventListener('click', () => {
            const obs = overlay.querySelector('#modal-obs').value.trim();
            const selectedDrinks = Object.entries(drinkSelections)
                .filter(([, qty]) => qty > 0)
                .map(([id, qty]) => {
                    const drink = BEBIDAS_DISPONIVEIS.find(d => d.id === id);
                    return { nome: drink.nome, quantidade: qty };
                });

            CART.addItem(currentProduct, 1, selectedDrinks, obs);
            closeModal(overlay);

            // Redirecionar para o carrinho
            window.location.href = 'cart/index.html';
        });
    }

    // ============================================================
    // ATUALIZAR UI DE BEBIDAS
    // ============================================================
    function updateDrinkUI(overlay, product) {
        const total = totalDrinks();
        overlay.querySelector('#drinks-count').textContent = `${total}/${product.maxBebidas}`;
        overlay.querySelector('#drinks-badge-ok').style.opacity = total > 0 ? '1' : '0.3';

        BEBIDAS_DISPONIVEIS.forEach(drink => {
            const qty = drinkSelections[drink.id] || 0;
            overlay.querySelector(`#qty-${drink.id}`).textContent = qty;
            overlay.querySelector(`.drink-minus[data-drink="${drink.id}"]`).classList.toggle('active-btn', qty > 0);
            overlay.querySelector(`.drink-plus[data-drink="${drink.id}"]`).classList.toggle('active-btn', total < product.maxBebidas);
        });

        overlay.querySelector('#modal-total-price').textContent = formatPrice(currentProduct.preco);
    }

    // ============================================================
    // FECHAR MODAL
    // ============================================================
    function closeModal(overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
        }, 350);
    }

    // ============================================================
    // INTERCEPTAR CLIQUES NOS CARDS DE PRODUTO
    // ============================================================
    function initProductInterception() {
        document.querySelectorAll('a[href*="product/"]').forEach(link => {
            const match = link.getAttribute('href').match(/product\/(\d+)/);
            if (!match) return;

            const productId = parseInt(match[1]);
            const product = findProductById(productId);
            if (!product) return;

            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openProductModal(product);
            });
        });
    }

    // ============================================================
    // INIT
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProductInterception);
    } else {
        initProductInterception();
    }

})();
