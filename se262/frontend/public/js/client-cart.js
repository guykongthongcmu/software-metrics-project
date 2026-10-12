var Cart = (function () {
  var STORAGE_KEY = 'coreAndCoCart';

  function getBadgeElement() {
    return document.getElementById('nav-cart-count') || document.querySelector('#nav-cart-btn .cart-count-badge');
  }

  function getLocalStorageCount() {
    var cart = getCart();
    return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function renderBadgeCount(total, animate) {
    var badge = getBadgeElement();
    if (!badge) return;

    var safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
    badge.textContent = safeTotal;
    badge.classList.toggle('cart-count--has', safeTotal > 0);

    if (animate) {
      badge.classList.remove('bounce');
      void badge.offsetWidth;
      badge.classList.add('bounce');
    }
  }

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateBadge(getLocalStorageCount());
  }

  async function updateBadge(totalOverride) {
    if (typeof totalOverride === 'number' && !Number.isNaN(totalOverride)) {
      renderBadgeCount(totalOverride, true);
      return totalOverride;
    }

    try {
      var response = await fetch('/api/client/cart?lang=EN', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.status === 401) {
        renderBadgeCount(0, false);
        return 0;
      }

      if (!response.ok) {
        var fallbackCount = getLocalStorageCount();
        renderBadgeCount(fallbackCount, false);
        return fallbackCount;
      }

      var json = await response.json().catch(function () { return null; });
      var total = Number(json && json.data && json.data.cartSummary && json.data.cartSummary.totalItems) || 0;
      renderBadgeCount(total, false);
      return total;
    } catch (e) {
      var fallback = getLocalStorageCount();
      renderBadgeCount(fallback, false);
      return fallback;
    }
  }

  function addToCart(product, qty, onDone) {
    var cart = getCart();
    var existing = cart.find(function (i) { return i.id === product.id && i.size === product.size; });
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        id:       product.id,
        name:     product.name,
        price:    product.price,
        image:    product.image,
        size:     product.size,
        color:    product.color,
        qty:      qty
      });
    }
    saveCart(cart);
    if (onDone) onDone();
  }

  function removeFromCart(id, size) {
    var cart = getCart().filter(function (i) { return !(i.id === id && i.size === size); });
    saveCart(cart);
  }

  function updateQty(id, size, qty) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id && i.size === size; });
    if (item) {
      item.qty = Math.max(1, qty);
      saveCart(cart);
    }
  }

  function getTotals() {
    var cart = getCart();
    var subtotal = cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    return { count: cart.reduce(function (s, i) { return s + i.qty; }, 0), subtotal: subtotal };
  }

  function flyToCart(originEl, onComplete) {
    var cartIcon = document.querySelector('.cart-link');
    if (!cartIcon || !originEl) { if (onComplete) onComplete(); return; }

    var fromRect = originEl.getBoundingClientRect();
    var toRect   = cartIcon.getBoundingClientRect();

    var fabric = document.createElement('div');
    fabric.innerHTML = '<svg viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="50"><rect x="4" y="2" width="32" height="42" rx="3" fill="#c4b49a" opacity="0.9"/><line x1="4" y1="10" x2="36" y2="10" stroke="#a09070" stroke-width="1.5"/><line x1="4" y1="18" x2="36" y2="18" stroke="#a09070" stroke-width="1"/><line x1="4" y1="26" x2="36" y2="26" stroke="#a09070" stroke-width="1"/><line x1="14" y1="2" x2="14" y2="44" stroke="#a09070" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="2" x2="26" y2="44" stroke="#a09070" stroke-width="0.8" opacity="0.5"/></svg>';
    fabric.style.cssText = [
      'position:fixed',
      'left:' + (fromRect.left + fromRect.width / 2 - 20) + 'px',
      'top:'  + (fromRect.top  + fromRect.height / 2 - 25) + 'px',
      'width:40px',
      'height:50px',
      'z-index:9999',
      'pointer-events:none',
      'transition:none',
      'transform-origin:center center',
    ].join(';');
    document.body.appendChild(fabric);

    var toX = toRect.left + toRect.width  / 2 - 20;
    var toY = toRect.top  + toRect.height / 2 - 25;

    var startX = fromRect.left + fromRect.width  / 2 - 20;
    var startY = fromRect.top  + fromRect.height / 2 - 25;
    var midX   = (startX + toX) / 2 - 40;
    var midY   = Math.min(startY, toY) - 80;

    fabric.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)',   opacity: 1   },
      { transform: 'translate(' + (midX - startX) + 'px,' + (midY - startY) + 'px) scale(0.9) rotate(-15deg)', opacity: 1, offset: 0.45 },
      { transform: 'translate(' + (toX  - startX) + 'px,' + (toY  - startY) + 'px) scale(0.2) rotate(10deg)',  opacity: 0 }
    ], {
      duration: 700,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    }).onfinish = function () {
      fabric.remove();
      cartIcon.classList.add('cart-bounce');
      setTimeout(function () { cartIcon.classList.remove('cart-bounce'); }, 400);
      if (onComplete) onComplete();
    };
  }

  function showToast(msg) {
    var existing = document.getElementById('cartToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'cartToast';
    toast.textContent = msg;
    toast.style.cssText = [
      'position:fixed',
      'bottom:28px',
      'left:50%',
      'transform:translateX(-50%) translateY(20px)',
      'background:#2a2520',
      'color:#fff',
      'padding:10px 22px',
      'font-size:0.78rem',
      'letter-spacing:0.06em',
      'border-radius:24px',
      'z-index:9998',
      'opacity:0',
      'transition:opacity .3s, transform .3s',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.style.opacity  = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    setTimeout(function () {
      toast.style.opacity   = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function () { toast.remove(); }, 350);
    }, 2500);
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
  });

  function clearCart() {
    localStorage.removeItem(STORAGE_KEY);
    updateBadge();
  }

  return { getCart: getCart, addToCart: addToCart, removeFromCart: removeFromCart, updateQty: updateQty, getTotals: getTotals, flyToCart: flyToCart, showToast: showToast, updateBadge: updateBadge, clearCart: clearCart };
})();
