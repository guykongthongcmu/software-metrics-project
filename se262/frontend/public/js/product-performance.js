/**
 * Product Performance Matrix Logic - Enhanced for High Fidelity
 */

let purchaseChart, trafficChart, engagementChart;
const productSearch = document.getElementById('productSearch');
const searchResults = document.getElementById('searchResults');
const commentsListView = document.getElementById('commentsListView');
const productSummary = document.getElementById('productSummary');

const GOLDEN_STRAW = '#c8a77d';
const GOLDEN_STRAW_LIGHT = 'rgba(200, 167, 125, 0.15)';
const TEXT_MUTED = '#8e8e8e';

// Initialize Charts with high-fidelity styles
function initCharts() {
    const ctxBar = document.getElementById('purchaseChart').getContext('2d');
    const ctxLine = document.getElementById('trafficChart').getContext('2d');
    const ctxDonut = document.getElementById('engagementChart').getContext('2d');

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#3a3a3a',
                bodyColor: '#3a3a3a',
                borderColor: GOLDEN_STRAW,
                borderWidth: 1,
                padding: 10,
                displayColors: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
                ticks: { color: TEXT_MUTED, font: { size: 10 } }
            },
            x: {
                grid: { display: false },
                ticks: { color: TEXT_MUTED, font: { size: 10 } }
            }
        }
    };

    purchaseChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: GOLDEN_STRAW, borderRadius: 4, barThickness: 25 }] },
        options: commonOptions
    });

    const gradient = ctxLine.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, GOLDEN_STRAW_LIGHT);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    trafficChart = new Chart(ctxLine, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: GOLDEN_STRAW, borderWidth: 3, tension: 0.4, fill: true, backgroundColor: gradient, pointRadius: 0, pointHoverRadius: 6, pointHoverBackgroundColor: GOLDEN_STRAW }] },
        options: commonOptions
    });

    engagementChart = new Chart(ctxDonut, {
        type: 'doughnut',
        data: { labels: ['Likes', 'Neutral', 'Dislikes'], datasets: [{ data: [], backgroundColor: [GOLDEN_STRAW, '#e5dac9', '#3a3a3a'], borderWidth: 0, cutout: '82%' }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    // Default view for demo
    renderDefaultTrends();
}

function renderDefaultTrends() {
    const products = window.allProducts || [];
    if (products.length === 0) return;

    // commentsListView may not exist if the Recent Comments section was removed
    if (commentsListView) {
        const sortedByComments = [...products].sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0)).slice(0, 3);
        
        commentsListView.innerHTML = sortedByComments.map(p => {
            const commentCount = p.reviews?.length || 0;
            const maxComments = Math.max(...products.map(x => x.reviews?.length || 0)) || 1;
            const widthPercent = (commentCount / maxComments) * 90 + 5;
            
            return `
                <div class="comment-trend-item">
                    <div class="comment-trend-info">
                        <span class="comment-product-name">${p.name}</span>
                        <span class="comment-count">${commentCount * 12 + 42} comments</span>
                    </div>
                    <div class="comment-bar-container">
                        <div class="comment-avatars">
                            ${(p.reviews || []).slice(0, 3).map(r => `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(r.user)}&background=random" class="comment-avatar" alt="">`).join('')}
                            ${commentCount > 3 ? `<div class="comment-avatar-plus">+${commentCount - 3}</div>` : ''}
                        </div>
                        <div class="comment-bar-fill" style="width: ${widthPercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Global Engagement (Mock for default)
    updateDonutChart([70, 20, 10], 8400);
}

function updateDonutChart(data, totalValue) {
    engagementChart.data.datasets[0].data = data;
    engagementChart.update();
    document.getElementById('centerLikesValue').textContent = totalValue >= 1000 ? (totalValue/1000).toFixed(1) + 'k' : totalValue;
    
    const labels = ['Tops & Blouses', 'Bottoms', 'Accessories'];
    const colors = [GOLDEN_STRAW, '#e5dac9', '#3a3a3a'];
    document.getElementById('engagementLegend').innerHTML = labels.map((l, i) => `
        <div class="d-flex align-items-center gap-2">
            <span style="width: 30px; height: 3px; background: ${colors[i]}; border-radius: 2px;"></span>
            <span class="small fw-bold text-muted">${l}</span>
        </div>
    `).join('');
}

// Search Logic
productSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 1) {
        searchResults.style.display = 'none';
        return;
    }

    const products = window.allProducts || []; 
    const filtered = products.filter(p => 
        p.id.toLowerCase().includes(term) || 
        p.name.toLowerCase().includes(term) || 
        p.category.toLowerCase().includes(term)
    ).slice(0, 5);

    renderSearchResults(filtered);
});

function renderSearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="p-3 text-muted">No products found</div>';
    } else {
        searchResults.innerHTML = results.map(p => `
            <div class="search-item d-flex align-items-center p-2" onclick="loadProductPerformance('${p.id}')" style="cursor: pointer; border-radius: 8px;">
                <img src="${p.img || ''}" alt="" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" class="me-3">
                <div>
                    <div class="fw-bold small">${p.name}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${p.id} • ${p.category}</div>
                </div>
            </div>
        `).join('');
    }
    searchResults.style.display = 'block';
}

// Load Product Data
async function loadProductPerformance(productId) {
    searchResults.style.display = 'none';
    productSearch.value = '';

    const product = window.allProducts.find(p => p.id === productId);
    if (!product) return;

    // Show Summary
    productSummary.style.setProperty('display', 'flex', 'important');
    document.getElementById('summaryImage').src = product.img;
    document.getElementById('summaryName').textContent = product.name;
    document.getElementById('summaryCategory').textContent = product.category;
    document.getElementById('summaryPrice').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('summaryStock').textContent = `${product.stock} in stock`;
    document.getElementById('summaryID').textContent = `#${product.id}`;
    document.getElementById('summaryLikes').textContent = product.likes || 0;
    document.getElementById('summaryViews').textContent = product.views || 0;

    // Update Charts
    updateCharts(product.performance);

    // Update Velocity Badge
    const velocityBadge = document.getElementById('velocityBadge');
    if (velocityBadge) {
        velocityBadge.style.display = product.highVelocity ? 'block' : 'none';
    }
}

function updateCharts(perf) {
    if (!perf) return;

    // Bar Chart
    purchaseChart.data.labels = perf.barLabels;
    purchaseChart.data.datasets[0].data = perf.barData;
    purchaseChart.update();

    // Line Chart
    trafficChart.data.labels = perf.lineLabels;
    trafficChart.data.datasets[0].data = perf.lineData;
    trafficChart.update();

    // Donut Chart - Random for single product
    const likes = perf.engagementData[0];
    const total = Math.floor(perf.engagementData[0] * 12.5);
    updateDonutChart(perf.engagementData, total);
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    const dataElement = document.getElementById('product-data');
    if (dataElement) {
        window.allProducts = JSON.parse(dataElement.textContent);
    }
    
    initCharts();

    // Auto-load first product for demo
    if (window.allProducts && window.allProducts.length > 0) {
        loadProductPerformance(window.allProducts[0].id);
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!productSearch.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
    }
});
