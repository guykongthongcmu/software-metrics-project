/**
 * Antigravity Storefront - Dynamic Hero Banner Logic
 */

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        apiEndpoint: '/api/client/campaigns?lang=EN',
        defaults: {
            title: 'NEW COLLECTION',
            subtitle: 'SPRING/SUMMER COLLECTION 2026',
            cta: 'Explore Collection',
            ctaLink: '/search'
        }
    };

    /**
     * Fetch active campaigns from the backend.
     */
    async function fetchActiveCampaigns() {
        try {
            const response = await fetch(CONFIG.apiEndpoint);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            const json = await response.json();
            return json.data || [];
        } catch (error) {
            console.warn('Hero Banner Fetch Error:', error.message);
            return []; // Fail gracefully to fallback
        }
    }

    /**
     * Update the DOM elements with campaign data.
     */
    function updateHeroBanner(campaign) {
        const titleEl = document.getElementById('hero-title');
        const subtitleEl = document.getElementById('hero-subtitle');
        const ctaEl = document.getElementById('hero-cta');
        const imgEl = document.getElementById('hero-image');

        if (!campaign) {
            // Apply fallbacks
            if (titleEl) titleEl.textContent = CONFIG.defaults.title;
            if (subtitleEl) subtitleEl.textContent = CONFIG.defaults.subtitle;
            if (ctaEl) {
                ctaEl.textContent = CONFIG.defaults.cta;
                ctaEl.href = CONFIG.defaults.ctaLink;
            }
            return;
        }

        // Apply campaign content
        const title = campaign.name || CONFIG.defaults.title;
        const subtitle = campaign.message || CONFIG.defaults.subtitle;
        const cta = campaign.ctaText || 'Shop the Sale';
        const ctaLink = campaign.ctaUrl || `/search?campaign=${campaign.campaignId}`;

        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
        if (ctaEl) {
            ctaEl.textContent = cta;
            ctaEl.href = ctaLink;
        }

        // Potential for background image update if backend supports it
        // if (campaign.bannerImageUrl && imgEl) {
        //     imgEl.src = campaign.bannerImageUrl;
        //     imgEl.alt = title;
        // }

        // Apply fade-in animation
        [titleEl, subtitleEl, ctaEl].forEach(el => {
            if (el) {
                el.style.opacity = '0';
                el.classList.add('hero-fade-in');
            }
        });
    }

    // Initialize logic
    async function init() {
        const campaigns = await fetchActiveCampaigns();
        
        // Select the primary (first active) campaign
        const activeCampaign = campaigns.length > 0 ? campaigns[0] : null;
        
        updateHeroBanner(activeCampaign);
    }

    // Execute on DOM content loaded
    document.addEventListener('DOMContentLoaded', init);

})();
