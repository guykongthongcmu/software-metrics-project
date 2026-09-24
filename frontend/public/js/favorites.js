(function () {
    if (window.__favoritesScriptInitialized) {
        return;
    }
    window.__favoritesScriptInitialized = true;

    const FAVORITES_PAGE_PATH = '/favorites';
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        const amount = Number(value);
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        return `$${safeAmount.toFixed(2)}`;
    }

    function getFavoriteButtons(productId) {
        const normalizedId = String(productId);
        return Array.from(document.querySelectorAll('.favorite-toggle')).filter((button) => (
            String(button.dataset.id) === normalizedId
        ));
    }

    function setButtonState(button, isFavorite) {
        button.classList.toggle('active', isFavorite);
        button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
        const svg = button.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
        }
    }

    function setFavoriteState(productId, isFavorite) {
        getFavoriteButtons(productId).forEach((button) => {
            setButtonState(button, isFavorite);
        });
    }

    function setFavoritePending(productId, isPending) {
        getFavoriteButtons(productId).forEach((button) => {
            button.disabled = isPending;
            button.dataset.pending = isPending ? '1' : '0';
        });
    }

    function applyFavoriteIds(ids) {
        const activeIds = new Set((ids || []).map((id) => String(id)));
        document.querySelectorAll('.favorite-toggle').forEach((button) => {
            setButtonState(button, activeIds.has(String(button.dataset.id)));
        });
    }

    async function refreshFavoriteToggles() {
        try {
            const res = await fetch('/favorites/ids', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!res.ok) {
                return;
            }

            const json = await res.json();
            applyFavoriteIds(json.ids || []);
            updateFavBadge(Number(json.favoritesCount) || 0);
        } catch (error) {
        }
    }

    function updateFavBadge(count) {
        const badge = document.getElementById('nav-favorites-count')
            || document.querySelector('#nav-heart-btn .favorites-count-badge');
        if (!badge) {
            return;
        }

        badge.textContent = count;
        badge.classList.remove('bounce');
        void badge.offsetWidth;
        badge.classList.add('bounce');
    }

    function buildOptions(options, placeholder) {
        const items = Array.isArray(options) ? options : [];
        return [
            `<option value="" disabled selected>${escapeHtml(placeholder)}</option>`,
            ...items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
        ].join('');
    }

    function buildFavoritesCardMarkup(product) {
        const productId = Number(product.productId || product.id);
        const name = product.name || 'Product';
        const image = product.image || '';
        const sizes = Array.isArray(product.size) ? product.size : [];
        const colors = Array.isArray(product.color) ? product.color : [];
        const price = Number(product.price) || 0;

        return `
            <div class="product-card" onclick="location.href='/products/${productId}'" style="cursor:pointer;" data-product-id="${productId}">
                <div class="product-image-container">
                    <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" class="product-image">
                    <button type="button" class="favorite-toggle active" aria-label="Remove from favorites" aria-pressed="true" data-id="${productId}" onclick="event.preventDefault(); event.stopPropagation();">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="currentColor">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                </div>
                <div class="product-info-row">
                    <h3 class="product-name">${escapeHtml(name)}</h3>
                    <p class="product-price">${formatPrice(price)}</p>
                </div>
                <div class="product-action-container">
                    <div class="selectors-row" style="display: flex; gap: 10px; margin-bottom: 10px; width: 100%;">
                        <div class="size-dropdown-wrapper" style="flex: 1;">
                            <select class="size-select-full" onclick="event.stopPropagation()">
                                ${buildOptions(sizes, 'Select size')}
                            </select>
                        </div>
                        <div class="color-dropdown-wrapper" style="flex: 1;">
                            <select class="size-select-full" onclick="event.stopPropagation()">
                                ${buildOptions(colors, 'Select color')}
                            </select>
                        </div>
                    </div>
                    <button type="button" class="btn-add-cart-full" onclick='event.stopPropagation(); favAddToCart(this, ${JSON.stringify(String(productId))}, ${JSON.stringify(name)}, ${price}, ${JSON.stringify(image)})'>
                        ADD TO CART
                    </button>
                </div>
            </div>
        `;
    }

    function buildEmptyStateMarkup() {
        return `
            <div class="empty-state-card">
                <div class="empty-icon-wrapper">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="#1C1B1F" stroke-width="1.5" fill="none">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </div>
                <h2 class="empty-title">SAVE YOUR FAVOURITE ITEMS NOW !</h2>
                <div class="empty-message-container">
                    <p class="empty-message">You are absolutely able to explore your favourite items today.<br>We believe that you will experience with the good things in here.</p>
                </div>
                <a href="/" class="btn-start-shopping">START SHOPPING FROM MORE</a>
            </div>
        `;
    }

    function getFavoritesGrid() {
        return document.querySelector('.favorites-grid.filled-grid');
    }

    function createFavoritesGrid() {
        let grid = getFavoritesGrid();
        if (grid) {
            return grid;
        }

        const recommendations = document.querySelector('.recommendations-section');
        if (!recommendations) {
            return null;
        }

        const emptyState = document.querySelector('.empty-state-card');
        if (emptyState) {
            emptyState.remove();
        }

        grid = document.createElement('div');
        grid.className = 'favorites-grid filled-grid';
        recommendations.before(grid);
        return grid;
    }

    function syncFavoritesPageEmptyState() {
        if (window.location.pathname !== FAVORITES_PAGE_PATH) {
            return;
        }

        const grid = getFavoritesGrid();
        const hasCards = grid && grid.querySelector('.product-card[data-product-id]');
        const emptyState = document.querySelector('.empty-state-card');
        const recommendations = document.querySelector('.recommendations-section');

        if (hasCards) {
            if (emptyState) {
                emptyState.remove();
            }
            return;
        }

        if (grid) {
            grid.remove();
        }

        if (!emptyState && recommendations) {
            recommendations.insertAdjacentHTML('beforebegin', buildEmptyStateMarkup());
        }
    }

    function removeFavoriteCard(productId) {
        if (window.location.pathname !== FAVORITES_PAGE_PATH) {
            return;
        }

        const normalizedId = String(productId);
        document.querySelectorAll('.favorites-grid .product-card[data-product-id]').forEach((card) => {
            if (String(card.dataset.productId) === normalizedId) {
                card.remove();
            }
        });

        syncFavoritesPageEmptyState();
    }

    function upsertFavoriteCard(product) {
        if (window.location.pathname !== FAVORITES_PAGE_PATH || !product) {
            return;
        }

        const productId = String(product.productId || product.id);
        const existingCard = document.querySelector(`.favorites-grid .product-card[data-product-id="${productId}"]`);
        if (existingCard) {
            return;
        }

        const grid = createFavoritesGrid();
        if (!grid) {
            return;
        }

        grid.insertAdjacentHTML('afterbegin', buildFavoritesCardMarkup(product));
        syncFavoritesPageEmptyState();
    }

    async function handleFavoriteToggle(toggle, event) {
        event.preventDefault();
        event.stopPropagation();

        const productId = toggle.dataset.id;
        if (!productId || toggle.dataset.pending === '1') {
            return;
        }

        const wasFavorite = toggle.classList.contains('active');
        const method = wasFavorite ? 'DELETE' : 'POST';

        setFavoritePending(productId, true);
        setFavoriteState(productId, !wasFavorite);

        try {
            const res = await fetch(`/favorites/${productId}`, {
                method,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }

            const json = await res.json().catch(() => null);
            if (!res.ok || !json || json.status !== 'success') {
                setFavoriteState(productId, wasFavorite);
                return;
            }

            const isFavorite = Boolean(json.data && json.data.isFavorite);
            setFavoriteState(productId, isFavorite);
            updateFavBadge(Number(json.data && json.data.favoritesCount) || 0);

            if (isFavorite) {
                upsertFavoriteCard(json.data.product);
            } else {
                removeFavoriteCard(productId);
            }
        } catch (error) {
            console.error('Favorite error:', error);
            setFavoriteState(productId, wasFavorite);
        } finally {
            setFavoritePending(productId, false);
        }
    }

    document.addEventListener('click', (event) => {
        const toggle = event.target.closest('.favorite-toggle');
        if (!toggle) {
            return;
        }

        handleFavoriteToggle(toggle, event);
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refreshFavoriteToggles, { once: true });
    } else {
        refreshFavoriteToggles();
    }

    async function favAddToCart(btn, id, name, price, image) {
        var card = btn.closest('.product-card');
        var selects = card.querySelectorAll('select');
        var size = selects[0] ? selects[0].value : '';
        var color = selects[1] ? selects[1].value : '';
        var imageEl = card ? card.querySelector('.product-image') : null;

        if (!size) {
            alert('Please select a size');
            return;
        }
        if (!color) {
            alert('Please select a color');
            return;
        }

        btn.disabled = true;

        try {
            const res = await fetch('/api/cart/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: Number(id),
                    color: color,
                    size: size,
                    quantityCartItem: 1
                })
            });

            const json = await res.json().catch(() => null);

            if (res.ok) {
                Cart.updateBadge(Number(json && json.data && json.data.cartSummary && json.data.cartSummary.totalItems) || 0);
                Cart.flyToCart(imageEl, function () {
                    Cart.showToast(name + ' added to cart');
                });
            } else if (res.status === 401 || (json && json.code === 'UNAUTHORIZED')) {
                location.href = '/login';
            } else {
                Cart.showToast((json && json.message) || 'Could not add to cart');
            }
        } catch (err) {
            Cart.showToast('Could not connect to server');
        } finally {
            btn.disabled = false;
        }
    }

    window.refreshFavoriteToggles = refreshFavoriteToggles;
    window.favAddToCart = favAddToCart;
})();
