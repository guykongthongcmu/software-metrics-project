const fmt = (price) => `$${price.toFixed(2)}`;

const withFormatted = (p) => ({
    ...p,
    priceFormatted:    fmt(p.price),
    originalFormatted: p.originalPrice ? fmt(p.originalPrice) : null,
    badge:             p.discount ? `-${p.discount}%` : null,
});

const searchProducts = (products, { q, cat, sort, page, perPage = 15 }) => {
    const keyword = q.toLowerCase().trim();

    let filtered = products.filter((p) => {
        if (!keyword) return true;
        return (
            p.name.toLowerCase().includes(keyword) ||
            ((p.category || '').toLowerCase().includes(keyword)) ||
            (p.color && p.color.some((c) => c.toLowerCase().includes(keyword)))
        );
    });

    const categoryCounts = {
        all:   filtered.length,
        women: filtered.filter((p) => p.category === 'women').length,
        men:   filtered.filter((p) => p.category === 'men').length,
        kids:  filtered.filter((p) => p.category === 'kids').length,
    };

    if (cat !== 'all') filtered = filtered.filter((p) => p.category === cat);

    if (sort === 'price_asc')  filtered.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') filtered.sort((a, b) => b.price - a.price);
    if (sort === 'newest')     filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const totalResults = filtered.length;
    const totalPages   = Math.max(1, Math.ceil(totalResults / perPage));

    // For DOM pagination, we return ALL products
    return { 
        products: filtered.map(withFormatted), 
        counts: categoryCounts, 
        totalResults, 
        totalPages, 
        perPage 
    };
};

module.exports = { withFormatted, searchProducts };