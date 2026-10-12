/**
 * Antigravity Campaign Builder - Top 0.1% Architecture
 * 
 * Part 1: Real-time 'Liquid Glass' UI & Unified Dates
 * Part 2: Async FormData Bridge for Multipart Launch
 */

(function () {
    'use strict';

    // --- State Management ---
    const CampaignState = {
        name: '',
        type: '',
        discount: '',
        duration: { start: null, end: null },
        media: { file: null, url: null },
        isSubmitting: false
    };

    // --- DOM Reference Cache ---
    const dom = {
        form: document.getElementById('campaignForm'),
        inputs: {
            name: document.getElementById('campaignName'),
            type: document.getElementById('offerType'),
            discount: document.getElementById('discountValue'),
            duration: document.getElementById('campaignDuration'), // Unified Range Input
            mediaFile: document.getElementById('mediaUpload'),
            dropZone: document.getElementById('dropZone')
        },
        preview: {
            card: document.getElementById('previewCard'), // Parent for background image
            mediaLayer: document.getElementById('previewMedia'), // Layer for background injection
            title: document.getElementById('previewTitle'),
            badge: document.getElementById('previewType'),
            dates: document.getElementById('previewDates'),
            video: document.getElementById('previewVideo')
        },
        feedback: {
            box: document.getElementById('uploadFeedback'),
            name: document.getElementById('feedbackName'),
            icon: document.getElementById('feedbackIcon')
        }
    };

    let fpInstance = null;

    // --- Core Initialization ---
    function init() {
        initUnifiedDatePicker();
        attachPreviewListeners();
        attachMediaHandlers();
        attachSubmissionHandler();
    }

    /**
     * Requirement: Unified Date Range Picker (Flatpickr)
     */
    function initUnifiedDatePicker() {
        if (typeof flatpickr === 'undefined') return;

        fpInstance = flatpickr(dom.inputs.duration, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            minDate: 'today',
            prevArrow: '<i class="bi bi-chevron-left"></i>',
            nextArrow: '<i class="bi bi-chevron-right"></i>',
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    CampaignState.duration.start = selectedDates[0].toISOString().split('T')[0];
                    CampaignState.duration.end = selectedDates[1].toISOString().split('T')[0];
                    updatePreviewUI();
                }
            }
        });
    }
    /**
     * Requirement: Instant DOM Preview (Two-Way Binding)
     */
    function attachPreviewListeners() {
        const updateState = (e, key) => {
            CampaignState[key] = e.target.value;
            updatePreviewUI();
        };

        dom.inputs.name.addEventListener('input', (e) => updateState(e, 'name'));
        dom.inputs.type.addEventListener('change', (e) => updateState(e, 'type'));
        dom.inputs.discount.addEventListener('input', (e) => updateState(e, 'discount'));
    }

    function updatePreviewUI() {
        // Text/Badge Updates
        dom.preview.title.textContent = CampaignState.name || 'Your Sale Name';

        let badgeText = 'DISCOUNT TYPE';
        const type = CampaignState.type;
        const val = CampaignState.discount;

        if (type === 'PERCENTAGE_DISCOUNT') {
            badgeText = val ? `${val}% OFF` : 'Percentage Sale';
        } else if (type === 'FIXED_AMOUNT_DISCOUNT') {
            badgeText = val ? `$${val} OFF` : 'Fixed Discount';
        } else if (type) {
            badgeText = dom.inputs.type.options[dom.inputs.type.selectedIndex].text;
        }
        dom.preview.badge.textContent = badgeText;

        // Date Range Injection
        if (CampaignState.duration.start && CampaignState.duration.end) {
            dom.preview.dates.textContent = `${formatDate(CampaignState.duration.start)} — ${formatDate(CampaignState.duration.end)}`;
        } else {
            dom.preview.dates.textContent = 'Dates will appear here';
        }
    }

    /**
     * Requirement: Instant Media Background Preview (createObjectURL)
     */
    function attachMediaHandlers() {
        dom.inputs.dropZone.addEventListener('click', () => dom.inputs.mediaFile.click());

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            dom.inputs.dropZone.addEventListener(evt, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dom.inputs.dropZone.addEventListener('dragover', () => dom.inputs.dropZone.classList.add('dragover'));
        dom.inputs.dropZone.addEventListener('dragleave', () => dom.inputs.dropZone.classList.remove('dragover'));
        dom.inputs.dropZone.addEventListener('drop', e => {
            dom.inputs.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleMediaSelection(e.dataTransfer.files[0]);
        });

        dom.inputs.mediaFile.addEventListener('change', e => {
            if (e.target.files.length) handleMediaSelection(e.target.files[0]);
        });
    }

    function handleMediaSelection(file) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            showToast('Invalid File', 'Please upload an image or video.', 'danger');
            return;
        }

        // Cleanup previous object URL
        if (CampaignState.media.url) URL.revokeObjectURL(CampaignState.media.url);

        CampaignState.media.file = file;
        CampaignState.media.url = URL.createObjectURL(file);

        // Feedback Strip
        dom.feedback.box.style.display = 'flex';
        dom.feedback.name.textContent = file.name;
        dom.feedback.icon.className = file.type.startsWith('video/') ? 'bi bi-file-earmark-play' : 'bi bi-file-earmark-image';

        // Background Injection (The 'Liquid Glass' Preview)
        if (file.type.startsWith('image/')) {
            dom.preview.mediaLayer.style.backgroundImage = `url(${CampaignState.media.url})`;
            dom.preview.mediaLayer.style.backgroundSize = 'cover';
            dom.preview.mediaLayer.style.backgroundPosition = 'center';
            dom.preview.video.style.display = 'none';
        } else {
            dom.preview.video.src = CampaignState.media.url;
            dom.preview.video.style.display = 'block';
            dom.preview.mediaLayer.style.backgroundImage = 'none';
        }
    }

    window.clearUpload = function () {
        if (CampaignState.media.url) URL.revokeObjectURL(CampaignState.media.url);
        CampaignState.media.file = null;
        CampaignState.media.url = null;
        dom.inputs.mediaFile.value = '';
        dom.feedback.box.style.display = 'none';
        dom.preview.mediaLayer.style.backgroundImage = 'linear-gradient(135deg, #f1c40f, #e67e22)';
        dom.preview.video.style.display = 'none';
    };

    /**
     * Requirement: Admin Launch Logic (FormData Bridge)
     */
    function attachSubmissionHandler() {
        dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitCampaign();
        });
    }

    async function submitCampaign() {
        if (CampaignState.isSubmitting) return;
        CampaignState.isSubmitting = true;

        // Visual State Handling
        const summary = document.getElementById('launchInitial');
        const loading = document.getElementById('launchLoading');
        if (summary) summary.style.display = 'none';
        if (loading) loading.style.display = 'block';

        try {
            const formData = new FormData();
            
            // 1. Resolve Targets from the live DOM
            const productIds = Array.from(document.querySelectorAll('.target-prod-check:checked')).map(v => v.value);
            const categoryIds = Array.from(document.querySelectorAll('.target-cat-check:checked')).map(v => v.value);

            // 2. Build the Payload Metadata
            const metadata = {
                name: dom.inputs.name.value,
                type: dom.inputs.type.value,
                discountValue: parseFloat(dom.inputs.discount.value) || 0,
                startDate: CampaignState.duration.start,
                endDate: CampaignState.duration.end,
                productTargets: productIds,
                categoryTargets: categoryIds,
                channels: {
                    web: document.getElementById('chanWeb')?.checked || false,
                    email: document.getElementById('chanEmail')?.checked || false
                }
            };
            formData.append('campaignData', JSON.stringify(metadata));

            // 3. Attach Binary Media
            if (CampaignState.media.file) {
                formData.append('mediaFile', CampaignState.media.file);
            }

            // --- Top 0.1% Auth Implementation (Session Proxy Mode) ---
            // Using a relative URL through the 8080 proxy ensures cookies are sent correctly
            // Using adminFetch to ensure consistent authentication handling.
            const response = await adminFetch('/api/admin/launch-campaign', {
                method: 'POST',
                // FormData automatically handles 'multipart/form-data' boundary; do NOT set Content-Type
                body: formData
            });

            if (response.ok || response.status === 201) {
                const data = await response.json().catch(() => ({}));
                const blastSummary = data?.data?.emailBlast;
                const hasEmailFailures = blastSummary?.enabled && blastSummary.failedCount > 0;
                showToast(
                    hasEmailFailures ? 'Campaign Launched with Warnings' : 'Success!',
                    data?.message || 'Campaign launched successfully.',
                    hasEmailFailures ? 'warning' : 'success'
                );
                setTimeout(() => window.location.reload(), 1500);
            } else if (response.status === 401) {
                // SECURITY EVENT: Failed verification
                showToast('Session Expired', 'Please log in again as an administrator.', 'danger');
                setTimeout(() => window.location.href = '/admin/login', 2500);
                throw new Error('Unauthorized');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'The server rejected the campaign launch.');
            }

        } catch (error) {
            console.error('--- LAUNCH FAILURE ---', error);
            showToast('Launch Failed', error.message, 'danger');
            
            // Revert UI so user can fix and retry
            if (summary) summary.style.display = 'block';
            if (loading) loading.style.display = 'none';
        } finally {
            CampaignState.isSubmitting = false;
        }
    }

    // --- Helpers ---
    function formatDate(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function showToast(title, msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(title, msg, type);
        } else if (parent && typeof parent.showToast === 'function') {
            parent.showToast(title, msg, type);
        } else {
            console.log(`${title}: ${msg}`);
        }
    }

    // Run Boot
    document.addEventListener('DOMContentLoaded', init);

})();
