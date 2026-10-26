// API Configuration
const API_URL = 'http://localhost/smarthub';
let currentUser = null;
let cart = [];

// Returns Authorization header only when a real (non-demo) token is stored
function getAuthHeader() {
    const token = localStorage.getItem('token');
    if (token && token !== 'demo-token' && token.length > 10) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}
let allProducts = [];
let currentPage = 'home';
let detailProductId = null;

// ── DEMO MODE ──────────────────────────────────────────────────────────────
// When XAMPP/Apache is not running, the app automatically falls back to
// demo mode so signup, login, and orders all work without a backend.
let DEMO_MODE = false;   // set to true automatically on first fetch failure

function getDemoUsers() {
    return JSON.parse(localStorage.getItem('smarthub_demo_users') || '[]');
}
function saveDemoUsers(users) {
    localStorage.setItem('smarthub_demo_users', JSON.stringify(users));
}
function getDemoOrders() {
    return JSON.parse(localStorage.getItem('smarthub_demo_orders') || '[]');
}
function saveDemoOrders(orders) {
    localStorage.setItem('smarthub_demo_orders', JSON.stringify(orders));
}
// ──────────────────────────────────────────────────────────────────────────

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCart();
    checkUserSession();
    setupEventListeners();
    updateUserMenu();   // set correct nav state on load
});

// Setup Event Listeners
function setupEventListeners() {
    const hamburger = document.getElementById('hamburger');
    const cartIcon = document.getElementById('cartIcon');
    const searchInput = document.getElementById('searchInput');

    if (hamburger) {
        hamburger.addEventListener('click', toggleMobileMenu);
    }

    if (cartIcon) {
        cartIcon.addEventListener('click', openCart);
    }

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const cartModal = document.getElementById('cartModal');
        const productModal = document.getElementById('productModal');

        if (e.target === cartModal) {
            closeCart();
        }
        if (e.target === productModal) {
            closeProductModal();
        }
    });
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
}

// Load Products from Backend
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products.php?action=get_all`);
        
        if (!response.ok) {
            console.error('API Error:', response.status);
            showSampleProducts();
            return;
        }

        const data = await response.json();
        
        if (data.success) {
            // Normalize DB field names to match what the JS expects
            allProducts = data.products.map(p => ({
                ...p,
                // DB returns original_price (snake_case) → convert to originalPrice
                originalPrice: p.original_price !== undefined ? Number(p.original_price) : (p.originalPrice || p.price),
                price: Number(p.price),
                rating: Number(p.rating) || 4.5,
                // DB has no specs column → generate from description or use empty array
                specs: p.specs || generateSpecs(p)
            }));
            displayProducts(allProducts);
        } else {
            console.error('Error:', data.message);
            showSampleProducts();
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showSampleProducts();
    }
}

// Generate specs from description + category when DB doesn't have specs
function generateSpecs(product) {
    const cat = (product.category || '').toLowerCase();
    const specMap = {
        smartphones:  ['HD Display', 'Fast Processor', 'High-res Camera', 'Long Battery'],
        laptops:      ['Powerful CPU', 'Fast RAM', 'SSD Storage', 'HD Display'],
        audio:        ['Premium Sound', 'Long Battery', 'Noise Cancellation', 'Wireless'],
        accessories:  ['Compact Design', 'Durable Build', 'Easy Setup', 'Multi-use'],
    };
    return specMap[cat] || ['Premium Quality', 'High Performance', 'Great Value', 'Reliable'];
}

// Show Sample Products (if API fails)
function showSampleProducts() {
    allProducts = [
        {
            id: 1,
            name: 'iPhone 17 Pro',
            category: 'smartphones',
            price: 99999,
            originalPrice: 129999,
            rating: 4.8,
            image: 'images/iphone17pro.jpg',
            description: 'Latest flagship smartphone with advanced features',
            specs: ['6.1" Display', 'A19 Pro Chip', '48MP Camera', '4000mAh Battery']
        },
        {
            id: 2,
            name: 'Samsung Galaxy S24',
            category: 'smartphones',
            price: 79999,
            originalPrice: 99999,
            rating: 4.7,
            image: 'images/galaxys24.jpg',
            description: 'Premium Android smartphone with AI features',
            specs: ['6.2" Display', 'Snapdragon 8 Gen 3', '50MP Camera', '5000mAh Battery']
        },
        {
            id: 3,
            name: 'MacBook Pro 14"',
            category: 'laptops',
            price: 199999,
            originalPrice: 249999,
            rating: 4.9,
            image: 'images/macbookpro14.jpg',
            description: 'Powerful laptop for professionals',
            specs: ['M3 Pro Chip', '16GB RAM', '512GB SSD', '14.2" Display']
        },
        {
            id: 4,
            name: 'Dell 14 Plus',
            category: 'laptops',
            price: 149999,
            originalPrice: 179999,
            rating: 4.6,
            image: 'images/dell14plus.jpg',
            description: 'Sleek and powerful Windows laptop',
            specs: ['Intel Core i7', '16GB RAM', '512GB SSD', '14" Display']
        },
        {
            id: 5,
            name: 'Sony WH-1000XM5',
            category: 'audio',
            price: 24999,
            originalPrice: 29999,
            rating: 4.8,
            image: 'images/sonywh.jpg',
            description: 'Premium noise-cancelling headphones',
            specs: ['30-hour Battery', 'Active Noise Cancellation', 'LDAC', 'Fast Charge']
        },
        {
            id: 6,
            name: 'AirPods Pro',
            category: 'audio',
            price: 19999,
            originalPrice: 24999,
            rating: 4.7,
            image: 'images/airpodspro.webp',
            description: 'Apple wireless earbuds with ANC',
            specs: ['ANC & Transparency', 'Spatial Audio', '6-hour Battery', 'Charging Case']
        },
        {
            id: 7,
            name: 'iPad Air',
            category: 'accessories',
            price: 79999,
            originalPrice: 99999,
            rating: 4.6,
            image: 'images/ipadair.png',
            description: 'Versatile tablet for work and entertainment',
            specs: ['11" Display', 'M1 Chip', '8GB RAM', '256GB Storage']
        },
        {
            id: 8,
            name: 'Samsung Galaxy Watch',
            category: 'accessories',
            price: 19999,
            originalPrice: 24999,
            rating: 4.5,
            image: 'images/galaxywatch.jpg',
            description: 'Smartwatch with health tracking',
            specs: ['AMOLED Display', '10-day Battery', 'Health Tracking', 'GPS']
        }
    ];
    displayProducts(allProducts);
}

// Display Products
function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    
    if (!productsGrid) return;

    productsGrid.innerHTML = products.map(product => `
        <div class="product-card" onclick="viewProductDetail(${product.id})">
            <div class="product-image" style="position:relative;overflow:hidden;">
                <img src="${product.image || ''}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px 8px 0 0;cursor:zoom-in;transition:transform 0.3s ease;" onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#667eea,#764ba2)';this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:3rem;\'>📦</div>'" onclick="event.stopPropagation(); openLightbox(this.src, '${product.name}')">
                <div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.5);color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;pointer-events:none;">🔍</div>
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-rating">
                    <i class="fas fa-star"></i>
                    <span>${product.rating}</span>
                </div>
                <div class="product-price">
                    <span class="price">₹${product.price.toLocaleString()}</span>
                    ${(product.originalPrice || product.original_price || 0) > product.price ? `
                        <span class="original-price">₹${Number(product.originalPrice || product.original_price).toLocaleString()}</span>
                    ` : ''}
                </div>
                <div class="product-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); addToCart(${product.id})">
                        <i class="fas fa-shopping-cart"></i> Add
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); buyNowProduct(${product.id})">
                        <i class="fas fa-bolt"></i> Buy
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// View Product Detail
function viewProductDetail(productId) {
    const product = allProducts.find(p => p.id == productId);
    if (!product) return;

    detailProductId = productId;
    document.getElementById('detailImage').src = product.image; document.getElementById('detailImage').alt = product.name; document.getElementById('detailImage').style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:8px;cursor:zoom-in;'; document.getElementById('detailImage').onclick = function(){ openLightbox(this.src, product.name); };
    document.getElementById('detailName').textContent = product.name;
    document.getElementById('detailRating').innerHTML = `
        ${Array(Math.floor(product.rating)).fill('<i class="fas fa-star"></i>').join('')}
        ${product.rating % 1 ? '<i class="fas fa-star-half-alt"></i>' : ''}
        <span>(${product.rating})</span>
    `;
    document.getElementById('detailPrice').textContent = `₹${product.price.toLocaleString()}`;
    const origPrice = product.originalPrice || product.original_price || product.price;
    document.getElementById('detailOriginalPrice').textContent = `₹${Number(origPrice).toLocaleString()}`;
    const discountPct = origPrice > product.price ? Math.round((1 - product.price / origPrice) * 100) : 0;
    document.getElementById('detailDiscount').textContent = discountPct > 0 ? `-${discountPct}%` : '';
    document.getElementById('detailDescription').textContent = product.description || '';
    const specs = product.specs || generateSpecs(product);
    document.getElementById('detailSpecs').innerHTML = specs.map(spec => 
        `<li><i class="fas fa-check"></i> ${spec}</li>`
    ).join('');
    document.getElementById('detailQty').value = 1;

    document.getElementById('productModal').classList.add('active');
}

// Close Product Modal
function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// ── IMAGE LIGHTBOX ──────────────────────────────────────────────────────────
function openLightbox(src, alt) {
    let lb = document.getElementById('imageLightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'imageLightbox';
        lb.style.cssText = 'display:none;position:fixed;z-index:9999;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);align-items:center;justify-content:center;animation:fadeIn 0.2s ease;cursor:zoom-out;';
        lb.innerHTML = `<div style="position:relative;max-width:90vw;max-height:90vh;">
            <img id="lightboxImg" src="" alt="" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
            <div id="lightboxCaption" style="text-align:center;color:#fff;margin-top:12px;font-size:16px;font-weight:500;"></div>
            <button onclick="closeLightbox()" style="position:absolute;top:-18px;right:-18px;background:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);line-height:1;">&times;</button>
        </div>`;
        lb.addEventListener('click', function(e){ if(e.target===lb) closeLightbox(); });
        document.body.appendChild(lb);
    }
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxImg').alt = alt || '';
    document.getElementById('lightboxCaption').textContent = alt || '';
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lb = document.getElementById('imageLightbox');
    if (lb) { lb.style.display = 'none'; document.body.style.overflow = ''; }
}

document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeLightbox(); });
// ──────────────────────────────────────────────────────────────────────────



// Quantity Controls
function increaseQty() {
    const input = document.getElementById('detailQty');
    input.value = parseInt(input.value) + 1;
}

function decreaseQty() {
    const input = document.getElementById('detailQty');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

// Add to Cart
function addToCart(productId, quantity = 1) {
    // Use == (loose) so string "1" and number 1 both match
    const product = allProducts.find(p => p.id == productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id == productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: productId,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity
        });
    }

    saveCart();
    updateCartCount();
    showToast(`${product.name} added to cart!`);
}

// Add to Cart from Detail Modal
function addToCartFromDetail() {
    const quantity = parseInt(document.getElementById('detailQty').value);
    addToCart(detailProductId, quantity);
    closeProductModal();
}

// Buy Now Product
function buyNowProduct(productId) {
    addToCart(productId, 1);
    goToCheckout();
}

// Buy Now from Detail
function buyNow() {
    const quantity = parseInt(document.getElementById('detailQty').value);
    addToCart(detailProductId, quantity);
    closeProductModal();
    goToCheckout();
}

// Open Cart
function openCart() {
    displayCartItems();
    document.getElementById('cartModal').classList.add('active');
}

// Close Cart
function closeCart() {
    document.getElementById('cartModal').classList.remove('active');
}

// Display Cart Items
function displayCartItems() {
    const cartItems = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #999; padding: 40px 0;">Your cart is empty</p>';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-image"><img src="${item.image}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.style.display='none';this.parentElement.innerHTML='📦';"></div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">₹${item.price.toLocaleString()}</div>
                <div>Qty: ${item.quantity}</div>
            </div>
            <div>
                <div style="text-align: right; margin-bottom: 10px;">
                    ₹${(item.price * item.quantity).toLocaleString()}
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    updateCartSummary();
}

// Remove from Cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId);
    saveCart();
    updateCartCount();
    displayCartItems();
}

// Update Cart Summary
function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    document.getElementById('subtotal').textContent = `₹${subtotal.toLocaleString()}`;
    document.getElementById('tax').textContent = `₹${Math.round(tax).toLocaleString()}`;
    document.getElementById('total').textContent = `₹${Math.round(total).toLocaleString()}`;
}

// Update Cart Count
function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
}

// Save Cart to LocalStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Load Cart from LocalStorage
function loadCart() {
    const saved = localStorage.getItem('cart');
    if (saved) {
        cart = JSON.parse(saved);
        updateCartCount();
    }
}

// Go to Checkout
function goToCheckout() {
    if (cart.length === 0) {
        showToast('Cart is empty!', 'error');
        return;
    }

    if (!currentUser) {
        goToPage('login');
        closeCart();
        return;
    }

    closeCart();
    goToPage('checkout');
}

// Go to Page
function goToPage(page) {
    currentPage = page;
    
    switch(page) {
        case 'login':
            showLoginPage();
            break;
        case 'signup':
            showSignupPage();
            break;
        case 'checkout':
            showCheckoutPage();
            break;
        case 'profile':
            showProfilePage();
            break;
        default:
            // Return to home
            window.scrollTo(0, 0);
    }
}

// Show Login Page
function showLoginPage() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'loginModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>Login to Smart Hub</h2>
            <form onsubmit="handleLogin(event)">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Email</label>
                    <input type="email" id="loginEmail" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Password</label>
                    <input type="password" id="loginPassword" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                </div>
                <button type="submit" class="btn btn-primary btn-block" style="margin-bottom: 10px;">Login</button>
            </form>
            <p style="text-align: center; margin-bottom: 6px;">
                <a href="javascript:void(0)" onclick="this.closest('.modal').remove(); showForgotPasswordModal()" style="color: #e74c3c; cursor: pointer; font-size: 14px;">🔑 Forgot Password?</a>
            </p>
            <p style="text-align: center;">
                Don't have an account? 
                <a href="javascript:void(0)" onclick="this.closest('.modal').remove(); goToPage('signup')" style="color: #667eea; cursor: pointer;">Sign Up</a>
            </p>
        </div>
    `;
    document.body.appendChild(modal);
}

// Show Signup Page
function showSignupPage() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'signupModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>

            <!-- Fill Details & Submit -->
            <div id="signupStep1">
                <h2 style="margin-bottom:4px;">Create Account</h2>
                <p style="color:#888;font-size:13px;margin-bottom:18px;">Fill in your details to get started.</p>
                <form onsubmit="handleSignup(event)">
                    <div style="margin-bottom: 13px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Full Name</label>
                        <input type="text" id="signupName" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom: 13px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Email</label>
                        <input type="email" id="signupEmail" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom: 13px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Phone (10 digits)</label>
                        <input type="tel" id="signupPhone" pattern="[0-9]{10}" maxlength="10" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing:border-box;" placeholder="10 digit number">
                    </div>
                    <div style="margin-bottom: 13px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Address</label>
                        <input type="text" id="signupAddress" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom: 18px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Password</label>
                        <input type="password" id="signupPassword" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing:border-box;">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="signupSubmitBtn" style="margin-bottom: 10px;">
                        Continue →
                    </button>
                </form>
                <p style="text-align: center; font-size:14px;">
                    Already have an account?
                    <a href="javascript:void(0)" onclick="this.closest('.modal').remove(); goToPage('login')" style="color: #667eea; cursor: pointer;">Login</a>
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// OTP box navigation for signup step 2
function suOtpInput(el, idx) {
    el.value = el.value.replace(/[^0-9]/g, '').slice(-1);
    document.getElementById('signupOtpError').textContent = '';
    el.style.borderColor = el.value ? '#667eea' : '#ddd';
    if (el.value && idx < 3) document.getElementById('suOtp' + (idx + 1))?.focus();
    const otp = [0,1,2,3].map(i => document.getElementById('suOtp'+i)?.value||'').join('');
    if (otp.length === 4) setTimeout(signupVerifyOTP, 150);
}
function suOtpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 0)
        document.getElementById('suOtp' + (idx - 1))?.focus();
}
function getSUOtpValue() {
    return [0,1,2,3].map(i => document.getElementById('suOtp'+i)?.value||'').join('');
}

// Resend timer for signup OTP
function startSUResendCountdown() {
    const link = document.getElementById('suResendLink');
    const timer = document.getElementById('suResendTimer');
    if (!link || !timer) return;
    let secs = 60;
    link.style.pointerEvents = 'none'; link.style.color = '#aaa';
    timer.textContent = ` (${secs}s)`;
    const iv = setInterval(() => {
        secs--;
        if (secs <= 0) {
            clearInterval(iv);
            link.style.pointerEvents = ''; link.style.color = '#667eea';
            timer.textContent = '';
        } else {
            timer.textContent = ` (${secs}s)`;
        }
    }, 1000);
}

async function signupResendOTP() {
    const email = document.getElementById('signupOtpEmail')?.textContent;
    const name  = document.getElementById('signupName')?.value || 'User';
    if (!email) return;
    const ok = await sendOTP(email, 'signup', name);
    if (ok) { showToast('OTP resent! Check your inbox.'); startSUResendCountdown(); }
}

async function signupVerifyOTP() {
    const otp   = getSUOtpValue();
    const email = document.getElementById('signupOtpEmail')?.textContent;
    if (otp.length < 4) {
        document.getElementById('signupOtpError').textContent = 'Please enter the complete 4-digit OTP.';
        return;
    }
    const btn = document.getElementById('signupOtpBtn');
    btn.disabled = true; btn.textContent = 'Verifying...';
    document.getElementById('signupOtpError').textContent = '';
    [0,1,2,3].forEach(i => { const el = document.getElementById('suOtp'+i); if (el) el.disabled = true; });

    try {
        const response = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_otp', email, otp, purpose: 'signup' })
        });
        const data = await response.json();

        if (data.success) {
            // Flash green
            [0,1,2,3].forEach(i => { const el = document.getElementById('suOtp'+i); if (el) el.style.borderColor = '#27ae60'; });
            setTimeout(() => {
                document.getElementById('signupModal')?.remove();
                showToast('🎉 Account created! Welcome to SmartHub!', 'success');
                // Auto-login the user right after OTP success
                // We fetch user info and log them in
                signupAutoLogin(email);
            }, 400);
        } else {
            [0,1,2,3].forEach(i => {
                const el = document.getElementById('suOtp'+i);
                if (el) { el.style.borderColor = '#e74c3c'; el.disabled = false; el.value = ''; }
            });
            document.getElementById('suOtp0')?.focus();
            document.getElementById('signupOtpError').textContent = data.message || 'Invalid OTP. Try again.';
            btn.disabled = false; btn.textContent = '✅ Verify & Create Account';
        }
    } catch (err) {
        [0,1,2,3].forEach(i => { const el = document.getElementById('suOtp'+i); if (el) el.disabled = false; });
        document.getElementById('signupOtpError').textContent = 'Network error. Please try again.';
        btn.disabled = false; btn.textContent = '✅ Verify & Create Account';
    }
}

// After signup OTP verified, prompt login so user goes straight home
async function signupAutoLogin(email) {
    showToast('✅ Email verified! Please log in to continue.', 'success');
    setTimeout(() => goToPage('login'), 800);
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // ── DEMO MODE FALLBACK ──
    if (DEMO_MODE) {
        const users = getDemoUsers();
        const user  = users.find(u => u.email === email && u.password === password);
        if (user) {
            currentUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address };
            localStorage.setItem('user', JSON.stringify(currentUser));
            localStorage.setItem('token', 'demo-token');
            showToast('Login successful!');
            document.getElementById('loginModal').remove();
            updateUserMenu();
        } else {
            showToast('Invalid email or password', 'error');
        }
        return;
    }
    // ────────────────────────

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

    try {
        const response = await fetch(`${API_URL}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
        });
        const data = await response.json();

        if (data.success && data.user) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            localStorage.setItem('token', data.token || '');
            showToast('Login successful!');
            document.getElementById('loginModal')?.remove();
            updateUserMenu();
        } else {
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        DEMO_MODE = true;
        handleLogin(event);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Login'; }
    }
}

// Handle Signup
async function handleSignup(event) {
    event.preventDefault();

    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const phone    = document.getElementById('signupPhone').value.trim();
    const address  = document.getElementById('signupAddress').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (phone.length !== 10 || isNaN(phone)) {
        showToast('Phone number must be 10 digits', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    // ── DEMO MODE FALLBACK ──
    if (DEMO_MODE) {
        const users = getDemoUsers();
        if (users.find(u => u.email === email)) {
            showToast('Email already registered', 'error');
            return;
        }
        const newUser = { id: Date.now(), name, email, phone, address, password };
        users.push(newUser);
        saveDemoUsers(users);
        currentUser = { id: newUser.id, name, email, phone, address };
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('token', 'demo-token');
        document.getElementById('signupModal')?.remove();
        updateUserMenu();
        showToast('🎉 Account created! Welcome to SmartHub!', 'success');
        goToPage('home');
        return;
    }
    // ────────────────────────

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating Account...'; }

    try {
        const response = await fetch(`${API_URL}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'signup', name, email, phone, address, password })
        });
        const data = await response.json();

        if (data.success && data.user) {
            // Account created — log user in and go to home
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            localStorage.setItem('token', data.token || '');
            document.getElementById('signupModal')?.remove();
            updateUserMenu();
            showToast('🎉 Account created! Welcome to SmartHub!', 'success');
            goToPage('home');
        } else {
            showToast(data.message || 'Signup failed', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Continue →'; }
        }
    } catch (error) {
        console.error('Signup error:', error);
        DEMO_MODE = true;
        if (document.getElementById('signupModal')) {
            handleSignup(event);
        }
    }
}

// Show Checkout Page
function showCheckoutPage() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'checkoutModal';
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>Checkout</h2>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px;">Delivery Address</h4>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Address</label>
                    <input type="text" id="deliveryAddress" value="${currentUser.address}" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px;">City</label>
                        <input type="text" value="Kolhāpur" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px;">Pincode</label>
                        <input type="text" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                </div>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px;">Payment Method</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 2px solid #667eea; border-radius: 8px; cursor: pointer; background: #fff;">
                        <input type="radio" name="paymentMethod" value="cod" checked style="accent-color: #667eea; width: 18px; height: 18px;">
                        <span style="font-size: 22px;">💵</span>
                        <div>
                            <div style="font-weight: bold; color: #333;">Cash on Delivery</div>
                            <div style="font-size: 13px; color: #888;">Pay when your order arrives</div>
                        </div>
                    </label>
                    <label style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: #fff; opacity: 0.6;">
                        <input type="radio" name="paymentMethod" value="online" disabled style="width: 18px; height: 18px;">
                        <span style="font-size: 22px;">💳</span>
                        <div>
                            <div style="font-weight: bold; color: #333;">Online Payment</div>
                            <div style="font-size: 13px; color: #e74c3c;">Coming Soon</div>
                        </div>
                    </label>
                </div>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px;">Order Summary</h4>
                <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
                    ${cart.map(item => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>${item.name} x${item.quantity}</span>
                            <span>₹${(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Subtotal</span>
                    <span>₹${subtotal.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <span>Tax (18%)</span>
                    <span>₹${Math.round(tax).toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; color: #667eea;">
                    <span>Total</span>
                    <span>₹${Math.round(total).toLocaleString()}</span>
                </div>
            </div>

            <button class="btn btn-primary btn-block" onclick="placeOrder()" style="margin-bottom: 10px;">Place Order</button>
            <button class="btn btn-secondary btn-block" onclick="this.parentElement.parentElement.remove()">Continue Shopping</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Place Order
async function placeOrder() {
    const deliveryAddress = document.getElementById('deliveryAddress').value;
    const paymentMethodEl = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'cod';
    const paymentLabel = paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment';
    
    if (!deliveryAddress.trim()) {
        showToast('Please enter delivery address', 'error');
        return;
    }

    // ── DEMO MODE FALLBACK ──
    if (DEMO_MODE) {
        const orders = getDemoOrders();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const newOrder = {
            id: Date.now(),
            order_number: 'ORD-' + Date.now(),
            user_id: currentUser ? currentUser.id : 0,
            items: [...cart],
            items_count: cart.length,
            delivery_address: deliveryAddress,
            payment_method: paymentLabel,
            total_amount: Math.round(subtotal * 1.18),
            status: 'pending',
            created_at: new Date().toISOString()
        };
        orders.push(newOrder);
        saveDemoOrders(orders);
        cart = [];
        saveCart();
        updateCartCount();
        showToast('Order placed! Payment: ' + paymentLabel);
        document.getElementById('checkoutModal').remove();
        setTimeout(() => viewOrders(), 1500);
        return;
    }
    // ────────────────────────

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/orders.php`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                action: 'create',
                items: cart,
                deliveryAddress,
                paymentMethod: paymentLabel,
                totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                _token: token  // fallback in case Apache strips Authorization header
            })
        });

        const data = await response.json();

        if (data.success) {
            cart = [];
            saveCart();
            updateCartCount();
            showToast('Order placed successfully!');
            document.getElementById('checkoutModal').remove();
            setTimeout(() => viewOrders(), 1500);
        } else {
            showToast(data.message || 'Order placement failed', 'error');
        }
    } catch (error) {
        console.error('Order error:', error);
        DEMO_MODE = true;
        placeOrder();
    }
}

// View Orders
async function viewOrders() {
    if (!currentUser) {
        goToPage('login');
        return;
    }

    // ── DEMO MODE FALLBACK ──
    if (DEMO_MODE) {
        const orders = getDemoOrders().filter(o => o.user_id === currentUser.id);
        showOrdersModal(orders);
        return;
    }
    // ────────────────────────

    try {
        const token = localStorage.getItem('token');
        const tokenParam = token && token !== 'demo-token' ? `&_token=${encodeURIComponent(token)}` : '';
        const response = await fetch(`${API_URL}/orders.php?action=get_user_orders${tokenParam}`, {
            headers: { ...getAuthHeader() }
        });

        const data = await response.json();

        if (data.success) {
            showOrdersModal(data.orders);
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
        DEMO_MODE = true;
        viewOrders();
    }
}

// Show Orders Modal
function showOrdersModal(orders) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>My Orders</h2>
            
            ${orders.length === 0 ? `
                <p style="text-align: center; color: #999; padding: 40px 0;">No orders yet</p>
            ` : `
                <div>
                    ${orders.map(order => `
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <div>
                                    <strong>Order #${order.id}</strong>
                                    <div style="color: #999; font-size: 14px;">${new Date(order.created_at).toLocaleDateString()}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #667eea; font-weight: bold;">₹${order.total_amount.toLocaleString()}</div>
                                    <div style="color: ${order.status === 'completed' ? '#28a745' : order.status === 'cancelled' ? '#dc3545' : '#ffc107'}; font-size: 14px; margin-top: 5px;">
                                        ${order.status.toUpperCase()}
                                    </div>
                                </div>
                            </div>
                            <div style="color: #666; margin-bottom: 10px;">
                                <div><strong>Items:</strong> ${order.items_count} items</div>
                                <div><strong>Delivery:</strong> ${order.delivery_address}</div>
                                <div><strong>Payment:</strong> ${order.payment_method || 'Cash on Delivery'}</div>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                ${order.status !== 'completed' && order.status !== 'cancelled' ? `
                                    <button class="btn btn-secondary" onclick="updateDeliveryAddress(${order.id})" style="padding: 8px 15px; font-size: 14px;">Change Address</button>
                                    <button class="btn btn-danger" onclick="cancelOrder(${order.id})" style="padding: 8px 15px; font-size: 14px; background: #dc3545;">Cancel Order</button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
    document.body.appendChild(modal);
}

// Update Delivery Address
function updateDeliveryAddress(orderId) {
    const newAddress = prompt('Enter new delivery address:');
    if (!newAddress) return;

    // ── DEMO MODE FALLBACK ──
    if (DEMO_MODE) {
        const orders = getDemoOrders();
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            orders[idx].delivery_address = newAddress;
            saveDemoOrders(orders);
            showToast('Address updated successfully!');
            document.querySelector('.modal.active')?.remove();
            viewOrders();
        } else {
            showToast('Order not found', 'error');
        }
        return;
    }
    // ────────────────────────

    fetch(`${API_URL}/orders.php`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeader()
        },
        body: JSON.stringify({
            action: 'update_address',
            orderId,
            newAddress,
            _token: localStorage.getItem('token')
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Address updated successfully!');
            viewOrders();
        }
    });
}

// Cancel Order
function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    // ── DEMO MODE FALLBACK ──
    if (DEMO_MODE) {
        const orders = getDemoOrders();
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            orders[idx].status = 'cancelled';
            saveDemoOrders(orders);
            showToast('Order cancelled successfully!');
            document.querySelector('.modal.active')?.remove();
            viewOrders();
        } else {
            showToast('Order not found', 'error');
        }
        return;
    }
    // ────────────────────────

    fetch(`${API_URL}/orders.php`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeader()
        },
        body: JSON.stringify({
            action: 'cancel',
            orderId,
            _token: localStorage.getItem('token')
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Order cancelled successfully!');
            viewOrders();
        }
    });
}

// Check User Session
function checkUserSession() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserMenu();
    }
}

// Update User Menu
function updateUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;

    if (currentUser) {
        // Logged in — replace icon with avatar circle that opens profile page
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        userMenu.innerHTML = `
            <div onclick="showProfilePage()" title="My Profile"
                style="width:38px;height:38px;border-radius:50%;
                       background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(224,231,255,0.9));
                       color:#667eea;display:flex;align-items:center;justify-content:center;
                       font-weight:700;font-size:15px;cursor:pointer;
                       border:2px solid rgba(255,255,255,0.6);
                       box-shadow:0 2px 8px rgba(0,0,0,0.15);
                       transition:transform 0.2s,box-shadow 0.2s;"
                onmouseover="this.style.transform='scale(1.08)';this.style.boxShadow='0 4px 14px rgba(0,0,0,0.2)'"
                onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'"
            >${initials}</div>
        `;
    } else {
        // Not logged in — keep icon + hover dropdown with Login/Signup
        userMenu.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <div class="dropdown" id="userDropdown">
                <a href="javascript:void(0)" onclick="goToPage('login')">Login</a>
                <a href="javascript:void(0)" onclick="goToPage('signup')">Sign Up</a>
            </div>
        `;
    }
}

// ── USER PROFILE PAGE ───────────────────────────────────────────────────────
function showProfilePage() {
    if (!currentUser) { goToPage('login'); return; }

    document.getElementById('profilePageOverlay')?.remove();

    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const memberSince = currentUser.created_at
        ? new Date(currentUser.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'Smart Hub Member';

    const overlay = document.createElement('div');
    overlay.id = 'profilePageOverlay';
    overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.55);z-index:2500;
        display:flex;align-items:center;justify-content:center;
        animation:fadeIn 0.25s ease;padding:16px;box-sizing:border-box;
    `;

    overlay.innerHTML = `
        <div style="background:#fff;border-radius:20px;width:100%;max-width:460px;
                    max-height:92vh;overflow-y:auto;animation:slideUp 0.3s ease;
                    box-shadow:0 20px 60px rgba(0,0,0,0.3);">

            <!-- ── HEADER ── -->
            <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                        padding:28px 24px 24px;border-radius:20px 20px 0 0;position:relative;">
                <span onclick="document.getElementById('profilePageOverlay').remove()"
                      style="position:absolute;top:14px;right:18px;color:rgba(255,255,255,0.75);
                             font-size:26px;cursor:pointer;line-height:1;font-weight:300;">&times;</span>

                <div style="display:flex;align-items:center;gap:18px;">
                    <!-- Avatar -->
                    <div style="width:68px;height:68px;border-radius:50%;
                                background:rgba(255,255,255,0.2);border:3px solid rgba(255,255,255,0.5);
                                display:flex;align-items:center;justify-content:center;
                                font-size:26px;font-weight:700;color:#fff;flex-shrink:0;">
                        ${initials}
                    </div>
                    <div style="min-width:0;">
                        <div style="color:#fff;font-size:20px;font-weight:700;
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${currentUser.name}
                        </div>
                        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:3px;">
                            ${currentUser.email || ''}
                        </div>
                        ${currentUser.phone ? `
                        <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">
                            📱 ${currentUser.phone}
                        </div>` : ''}
                        <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:5px;">
                            ${memberSince}
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── MENU ITEMS ── -->
            <div style="padding:16px 16px 20px;">

                <!-- My Orders -->
                <div onclick="document.getElementById('profilePageOverlay').remove(); viewOrders();"
                     style="display:flex;align-items:center;gap:14px;padding:15px 14px;
                            border-radius:12px;cursor:pointer;margin-bottom:8px;transition:background 0.2s;"
                     onmouseover="this.style.background='#f5f3ff'" onmouseout="this.style.background=''">
                    <div style="width:46px;height:46px;border-radius:12px;background:#ede9fe;
                                display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📦</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;color:#1a1a1a;font-size:15px;">My Orders</div>
                        <div style="font-size:12px;color:#888;margin-top:2px;">Track & manage your orders</div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#ccc;font-size:13px;"></i>
                </div>

                <!-- Edit Address -->
                <div onclick="document.getElementById('profilePageOverlay').remove(); showEditAddressModal();"
                     style="display:flex;align-items:center;gap:14px;padding:15px 14px;
                            border-radius:12px;cursor:pointer;margin-bottom:8px;transition:background 0.2s;"
                     onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background=''">
                    <div style="width:46px;height:46px;border-radius:12px;background:#dcfce7;
                                display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📍</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;color:#1a1a1a;font-size:15px;">Edit Address</div>
                        <div style="font-size:12px;color:#888;margin-top:2px;
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${currentUser.address || 'Add your delivery address'}
                        </div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#ccc;font-size:13px;"></i>
                </div>

                <!-- Edit Profile -->
                <div onclick="document.getElementById('profilePageOverlay').remove(); showEditProfileModal();"
                     style="display:flex;align-items:center;gap:14px;padding:15px 14px;
                            border-radius:12px;cursor:pointer;margin-bottom:8px;transition:background 0.2s;"
                     onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background=''">
                    <div style="width:46px;height:46px;border-radius:12px;background:#dbeafe;
                                display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">✏️</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#1a1a1a;font-size:15px;">Edit Profile</div>
                        <div style="font-size:12px;color:#888;margin-top:2px;">Update name, email & phone</div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#ccc;font-size:13px;"></i>
                </div>

                <!-- Help & Support -->
                <div onclick="document.getElementById('profilePageOverlay').remove(); showHelpModal();"
                     style="display:flex;align-items:center;gap:14px;padding:15px 14px;
                            border-radius:12px;cursor:pointer;margin-bottom:8px;transition:background 0.2s;"
                     onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background=''">
                    <div style="width:46px;height:46px;border-radius:12px;background:#fed7aa;
                                display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">💬</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#1a1a1a;font-size:15px;">Help & Support</div>
                        <div style="font-size:12px;color:#888;margin-top:2px;">FAQs & contact us</div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#ccc;font-size:13px;"></i>
                </div>

                <!-- Divider -->
                <div style="height:1px;background:#f0f0f0;margin:10px 0 10px;"></div>

                <!-- Logout -->
                <div onclick="document.getElementById('profilePageOverlay').remove(); logout();"
                     style="display:flex;align-items:center;gap:14px;padding:15px 14px;
                            border-radius:12px;cursor:pointer;transition:background 0.2s;"
                     onmouseover="this.style.background='#fff1f2'" onmouseout="this.style.background=''">
                    <div style="width:46px;height:46px;border-radius:12px;background:#ffe4e6;
                                display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🚪</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#e74c3c;font-size:15px;">Logout</div>
                        <div style="font-size:12px;color:#aaa;margin-top:2px;">Sign out of your account</div>
                    </div>
                </div>

            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

// Edit Address Modal
function showEditAddressModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'editAddressModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:420px;">
            <span class="close" onclick="this.parentElement.parentElement.remove(); showProfilePage()">&times;</span>
            <h2 style="margin-bottom:6px;">Edit Address</h2>
            <p style="color:#888;font-size:13px;margin-bottom:20px;">This address will be used for your deliveries.</p>

            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;">Full Name</label>
                <input type="text" id="eaName" value="${currentUser.name || ''}"
                       style="width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;">Phone Number</label>
                <input type="tel" id="eaPhone" value="${currentUser.phone || ''}" maxlength="10"
                       placeholder="10-digit mobile number"
                       style="width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;">Delivery Address</label>
                <textarea id="eaAddress" rows="3"
                          placeholder="House/Flat No., Street, Area, City, PIN"
                          style="width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;resize:vertical;">${currentUser.address || ''}</textarea>
            </div>
            <button class="btn btn-primary btn-block" onclick="saveUserAddress()" style="margin-bottom:10px;">
                <i class="fas fa-save"></i> Save Address
            </button>
            <button class="btn btn-secondary btn-block" onclick="this.closest('.modal').remove(); showProfilePage()">
                Cancel
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveUserAddress() {
    const name    = document.getElementById('eaName')?.value.trim();
    const phone   = document.getElementById('eaPhone')?.value.trim();
    const address = document.getElementById('eaAddress')?.value.trim();

    if (!address) { showToast('Please enter your delivery address', 'error'); return; }

    if (name)  currentUser.name    = name;
    if (phone) currentUser.phone   = phone;
    currentUser.address = address;
    localStorage.setItem('user', JSON.stringify(currentUser));

    document.getElementById('editAddressModal')?.remove();
    showToast('Address saved successfully! ✅');
    updateUserMenu();
}

// Edit Profile Modal
function showEditProfileModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'editProfileModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:420px;">
            <span class="close" onclick="this.parentElement.parentElement.remove(); showProfilePage()">&times;</span>
            <h2 style="margin-bottom:6px;">Edit Profile</h2>
            <p style="color:#888;font-size:13px;margin-bottom:20px;">Update your personal information.</p>

            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;">Full Name</label>
                <input type="text" id="epName" value="${currentUser.name || ''}"
                       style="width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;">Email</label>
                <input type="email" id="epEmail" value="${currentUser.email || ''}"
                       style="width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;">Phone Number</label>
                <input type="tel" id="epPhone" value="${currentUser.phone || ''}" maxlength="10"
                       placeholder="10-digit mobile number"
                       style="width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;">
            </div>
            <button class="btn btn-primary btn-block" onclick="saveEditProfile()" style="margin-bottom:10px;">
                <i class="fas fa-check"></i> Save Changes
            </button>
            <button class="btn btn-secondary btn-block" onclick="this.closest('.modal').remove(); showProfilePage()">
                Cancel
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveEditProfile() {
    const name  = document.getElementById('epName')?.value.trim();
    const email = document.getElementById('epEmail')?.value.trim();
    const phone = document.getElementById('epPhone')?.value.trim();

    if (!name) { showToast('Name cannot be empty', 'error'); return; }

    currentUser.name  = name;
    currentUser.email = email  || currentUser.email;
    currentUser.phone = phone  || currentUser.phone;
    localStorage.setItem('user', JSON.stringify(currentUser));

    document.getElementById('editProfileModal')?.remove();
    showToast('Profile updated successfully! ✅');
    updateUserMenu();
}

// Help & Support Modal
function showHelpModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'helpModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:440px;">
            <span class="close" onclick="this.parentElement.parentElement.remove(); showProfilePage()">&times;</span>
            <h2 style="margin-bottom:6px;">Help & Support</h2>
            <p style="color:#888;font-size:13px;margin-bottom:20px;">We're here to help you!</p>

            <div style="display:flex;flex-direction:column;gap:12px;">
                <div style="background:#f5f3ff;padding:16px 18px;border-radius:12px;border-left:4px solid #667eea;">
                    <div style="font-weight:600;color:#333;margin-bottom:4px;">📞 Call Us</div>
                    <div style="color:#667eea;font-size:14px;font-weight:600;">+91 XXXXX XXXXX</div>
                    <div style="color:#999;font-size:12px;margin-top:2px;">Available 10 AM – 10 PM (Daily)</div>
                </div>
                <div style="background:#f0fdf4;padding:16px 18px;border-radius:12px;border-left:4px solid #28a745;">
                    <div style="font-weight:600;color:#333;margin-bottom:4px;">✉️ Email Support</div>
                    <div style="color:#28a745;font-size:14px;font-weight:600;">prakashlad078@gmail.com</div>
                    <div style="color:#999;font-size:12px;margin-top:2px;">We reply within 24 hours</div>
                </div>
                <div style="background:#fff7ed;padding:16px 18px;border-radius:12px;border-left:4px solid #ffc107;">
                    <div style="font-weight:600;color:#333;margin-bottom:4px;">📍 Visit Our Store</div>
                    <div style="color:#555;font-size:14px;">Main Market, Devgad, Maharashtra 416630</div>
                </div>

                <div style="background:#f9f9f9;padding:16px 18px;border-radius:12px;">
                    <div style="font-weight:600;color:#333;margin-bottom:12px;">❓ Frequently Asked Questions</div>
                    <div style="border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:10px;">
                        <div style="font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">What is the return policy?</div>
                        <div style="font-size:13px;color:#777;">7-day easy returns on all products with original packaging.</div>
                    </div>
                    <div style="border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:10px;">
                        <div style="font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">When will my order be delivered?</div>
                        <div style="font-size:13px;color:#777;">Same-day delivery available within Devgad. Other areas: 2–5 days.</div>
                    </div>
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#555;margin-bottom:4px;">Do all products come with warranty?</div>
                        <div style="font-size:13px;color:#777;">Yes! Extended warranty available on all products.</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
// ── END PROFILE PAGE ────────────────────────────────────────────────────────

// Logout
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    currentUser = null;
    updateUserMenu();
    showToast('Logged out successfully!');
}

// Handle Search
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
    displayProducts(filtered);
}

// Filter Products
function filterProducts(categoryOrEvent, category) {
    // Support both filterProducts('cat') and filterProducts(event,'cat') call styles
    let cat = category;
    let evtTarget = null;
    if (typeof categoryOrEvent === 'string') {
        cat = categoryOrEvent;
        evtTarget = window.event && window.event.target;
    } else if (categoryOrEvent && categoryOrEvent.target) {
        evtTarget = categoryOrEvent.target;
    }
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (evtTarget) evtTarget.classList.add('active');

    // Filter products
    if (cat === 'all') {
        displayProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === cat);
        displayProducts(filtered);
    }
}

// Show Toast Notification

// Show Email Verification Notice Modal
function showVerificationNotice(message) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px;text-align:center;padding:40px 36px;">
            <div style="font-size:64px;margin-bottom:16px;">📧</div>
            <h2 style="margin-bottom:12px;color:#333;">Check Your Email</h2>
            <p style="color:#666;line-height:1.7;margin-bottom:24px;">${message}</p>
            <div style="background:#f0f4ff;border-radius:10px;padding:16px;margin-bottom:24px;text-align:left;">
                <p style="margin:0;font-size:14px;color:#555;">
                    <strong>📌 Steps:</strong><br>
                    1. Open your email inbox<br>
                    2. Look for an email from <strong>SmartHub</strong><br>
                    3. Click the <strong>"Verify My Email"</strong> button<br>
                    4. Come back here and log in!
                </p>
            </div>
            <p style="font-size:13px;color:#999;margin-bottom:20px;">
                Didn't receive it? Check your spam folder or try signing up again.
            </p>
            <button class="btn btn-primary" onclick="this.closest('.modal').remove()" style="width:100%;">
                Got it!
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ── OTP SYSTEM ─────────────────────────────────────────────────────────────

// Send OTP via backend
async function sendOTP(email, purpose, name = '') {
    try {
        const response = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_otp', email, purpose, name })
        });
        const data = await response.json();
        if (!data.success) {
            showToast(data.message || 'Failed to send OTP', 'error');
            return false;
        }
        return true;
    } catch (err) {
        console.error('sendOTP error:', err);
        return false;
    }
}

// Show OTP Modal
function showOTPModal(email, purpose, message) {
    // Remove any existing OTP modal
    const existing = document.getElementById('otpModal');
    if (existing) existing.remove();

    const isLogin  = purpose === 'login';
    const title    = isLogin ? '🔐 Login Verification' : '📧 Email Verification';
    const subtitle = `Enter the 4-digit OTP sent to <strong>${email}</strong>`;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'otpModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">
            <h2 style="margin-bottom:6px;">${title}</h2>
            <p style="color:#666;font-size:14px;margin-bottom:24px;">${subtitle}</p>

            <div id="otpBoxes" style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;">
                ${[0,1,2,3].map(i => `
                <input id="otp${i}" type="text" inputmode="numeric" maxlength="1"
                    style="width:58px;height:66px;font-size:28px;font-weight:700;text-align:center;
                           border:2px solid #ddd;border-radius:10px;outline:none;
                           transition:border-color 0.2s,box-shadow 0.2s;"
                    oninput="otpInput(this,${i})"
                    onkeydown="otpKeyDown(event,${i})"
                    onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'"
                    onblur="this.style.borderColor='#ddd';this.style.boxShadow='none'"
                >
                `).join('')}
            </div>

            <div id="otpError" style="color:#e74c3c;font-size:13px;min-height:18px;margin-bottom:14px;"></div>

            <button onclick="verifyOTP('${email}','${purpose}')"
                class="btn btn-primary btn-block" id="otpVerifyBtn"
                style="margin-bottom:14px;">
                ✅ Verify OTP
            </button>

            <p style="font-size:13px;color:#888;margin:0;">
                Didn't receive it?
                <a href="javascript:void(0)" id="resendLink" onclick="resendOTP('${email}','${purpose}','${purpose === 'login' ? '' : ''}')">
                    Resend OTP
                </a>
                <span id="resendTimer" style="color:#aaa;font-size:12px;"></span>
            </p>
        </div>
    `;
    document.body.appendChild(modal);

    // Focus first box
    setTimeout(() => document.getElementById('otp0')?.focus(), 100);
    // Start resend countdown (60s)
    startResendCountdown();
}

// OTP box input navigation
function otpInput(el, idx) {
    el.value = el.value.replace(/[^0-9]/g, '').slice(-1);
    document.getElementById('otpError').textContent = '';
    el.style.borderColor = el.value ? '#667eea' : '#ddd';
    if (el.value && idx < 3) {
        document.getElementById('otp' + (idx + 1))?.focus();
    }
    // Auto-verify when all 4 filled
    const otp = getOTPValue();
    if (otp.length === 4) {
        const purpose = document.getElementById('otpModal').querySelector('button[onclick*="verifyOTP"]')
            ?.getAttribute('onclick')?.match(/'([^']+)','([^']+)'/)?.[2];
        const email   = document.getElementById('otpModal').querySelector('button[onclick*="verifyOTP"]')
            ?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (email && purpose) setTimeout(() => verifyOTP(email, purpose), 150);
    }
}

function otpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        document.getElementById('otp' + (idx - 1))?.focus();
    }
}

function getOTPValue() {
    return [0,1,2,3].map(i => document.getElementById('otp' + i)?.value || '').join('');
}

// Verify OTP
async function verifyOTP(email, purpose) {
    const otp = getOTPValue();
    if (otp.length < 4) {
        document.getElementById('otpError').textContent = 'Please enter the complete 4-digit OTP.';
        return;
    }

    const btn = document.getElementById('otpVerifyBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    document.getElementById('otpError').textContent = '';

    // Shake boxes during verify
    [0,1,2,3].forEach(i => {
        const el = document.getElementById('otp' + i);
        if (el) { el.style.borderColor = '#667eea'; el.disabled = true; }
    });

    try {
        const response = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_otp', email, otp, purpose })
        });
        const data = await response.json();

        if (data.success) {
            // Flash green
            [0,1,2,3].forEach(i => {
                const el = document.getElementById('otp' + i);
                if (el) el.style.borderColor = '#27ae60';
            });

            setTimeout(() => {
                document.getElementById('otpModal')?.remove();

                if (purpose === 'login' && data.user) {
                    currentUser = data.user;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    localStorage.setItem('token', data.token || '');
                    updateUserMenu();
                    showToast('Login successful! Welcome back, ' + currentUser.name + ' 👋');
                } else {
                    showToast('Email verified! You can now log in.', 'success');
                    setTimeout(() => goToPage('login'), 800);
                }
            }, 400);
        } else {
            // Flash red & shake
            [0,1,2,3].forEach(i => {
                const el = document.getElementById('otp' + i);
                if (el) { el.style.borderColor = '#e74c3c'; el.disabled = false; el.value = ''; }
            });
            document.getElementById('otp0')?.focus();
            document.getElementById('otpError').textContent = data.message || 'Invalid OTP. Please try again.';
            btn.disabled = false;
            btn.textContent = '✅ Verify OTP';
        }
    } catch (err) {
        console.error('verifyOTP error:', err);
        document.getElementById('otpError').textContent = 'Network error. Please try again.';
        [0,1,2,3].forEach(i => {
            const el = document.getElementById('otp' + i);
            if (el) el.disabled = false;
        });
        btn.disabled = false;
        btn.textContent = '✅ Verify OTP';
    }
}

// Resend OTP
async function resendOTP(email, purpose, name) {
    const link  = document.getElementById('resendLink');
    const timer = document.getElementById('resendTimer');
    if (!link || link.style.pointerEvents === 'none') return;

    link.style.pointerEvents = 'none';
    link.style.color = '#ccc';
    [0,1,2,3].forEach(i => { const el = document.getElementById('otp' + i); if (el) el.value = ''; });
    document.getElementById('otpError').textContent = '';
    document.getElementById('otp0')?.focus();

    const sent = await sendOTP(email, purpose, name);
    if (sent) {
        showToast('New OTP sent to ' + email);
        startResendCountdown();
    } else {
        link.style.pointerEvents = '';
        link.style.color = '';
    }
}

// 60-second resend countdown
function startResendCountdown() {
    const link  = document.getElementById('resendLink');
    const timer = document.getElementById('resendTimer');
    if (!link || !timer) return;

    link.style.pointerEvents = 'none';
    link.style.color = '#ccc';
    let secs = 60;

    const iv = setInterval(() => {
        secs--;
        timer.textContent = ` (${secs}s)`;
        if (secs <= 0) {
            clearInterval(iv);
            timer.textContent = '';
            link.style.pointerEvents = '';
            link.style.color = '#667eea';
        }
    }, 1000);
}

// ───────────────────────────────────────────────────────────────────────────

// ── FORGOT PASSWORD SYSTEM ──────────────────────────────────────────────────

// Step 1: Show "Enter your Gmail" modal
function showForgotPasswordModal() {
    const existing = document.getElementById('forgotModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'forgotModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>

            <div style="width:64px;height:64px;background:linear-gradient(135deg,#667eea,#764ba2);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;
                        margin:0 auto 16px;font-size:28px;">🔑</div>

            <h2 style="margin:0 0 8px;">Forgot Password?</h2>
            <p style="color:#888;font-size:14px;margin:0 0 24px;line-height:1.6;">
                Enter your registered Gmail address.<br>We'll send you a 4-digit OTP to reset your password.
            </p>

            <div style="text-align:left;margin-bottom:16px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;">Gmail Address</label>
                <input type="email" id="forgotEmail" placeholder="yourname@gmail.com"
                    style="width:100%;padding:12px;border:2px solid #ddd;border-radius:10px;
                           font-size:15px;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='#667eea'"
                    onblur="this.style.borderColor='#ddd'"
                    onkeydown="if(event.key==='Enter') sendForgotOTP()">
            </div>

            <div id="forgotError" style="color:#e74c3c;font-size:13px;min-height:18px;margin-bottom:12px;"></div>

            <button onclick="sendForgotOTP()"
                id="forgotSendBtn"
                class="btn btn-primary btn-block"
                style="margin-bottom:14px;">
                📨 Send OTP
            </button>

            <p style="font-size:13px;color:#888;margin:0;">
                Remember your password?
                <a href="javascript:void(0)"
                   onclick="this.closest('.modal').remove(); goToPage('login')"
                   style="color:#667eea;cursor:pointer;">Login</a>
            </p>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('forgotEmail')?.focus(), 100);
}

// Step 2: Send OTP to the entered email
async function sendForgotOTP() {
    const email = document.getElementById('forgotEmail')?.value.trim();
    const errEl = document.getElementById('forgotError');
    const btn   = document.getElementById('forgotSendBtn');

    errEl.textContent = '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Sending OTP...';

    try {
        const res  = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_otp', email, purpose: 'forgot_password' })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('forgotModal').remove();
            showForgotOTPModal(email);
        } else {
            errEl.textContent = data.message || 'Failed to send OTP.';
            btn.disabled    = false;
            btn.textContent = '📨 Send OTP';
        }
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        btn.disabled    = false;
        btn.textContent = '📨 Send OTP';
    }
}

// Step 3: OTP entry modal (reuses the 4-box style)
function showForgotOTPModal(email) {
    const existing = document.getElementById('forgotOTPModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'forgotOTPModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>

            <div style="width:64px;height:64px;background:linear-gradient(135deg,#667eea,#764ba2);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;
                        margin:0 auto 16px;font-size:28px;">📧</div>

            <h2 style="margin:0 0 8px;">Enter OTP</h2>
            <p style="color:#666;font-size:14px;margin:0 0 6px;">OTP sent to</p>
            <p style="color:#667eea;font-weight:600;font-size:15px;margin:0 0 24px;">${email}</p>

            <div style="display:flex;justify-content:center;gap:12px;margin-bottom:20px;">
                ${[0,1,2,3].map(i => `
                <input id="fOtp${i}" type="text" inputmode="numeric" maxlength="1"
                    style="width:58px;height:66px;font-size:28px;font-weight:700;text-align:center;
                           border:2px solid #ddd;border-radius:10px;outline:none;
                           transition:border-color 0.2s,box-shadow 0.2s;"
                    oninput="fOtpInput(this,${i},'${email}')"
                    onkeydown="fOtpKeyDown(event,${i})"
                    onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'"
                    onblur="this.style.borderColor='#ddd';this.style.boxShadow='none'">
                `).join('')}
            </div>

            <div id="fOtpError" style="color:#e74c3c;font-size:13px;min-height:18px;margin-bottom:12px;"></div>

            <button onclick="verifyForgotOTP('${email}')"
                id="fOtpVerifyBtn" class="btn btn-primary btn-block" style="margin-bottom:14px;">
                ✅ Verify OTP
            </button>

            <p style="font-size:13px;color:#888;margin:0;">
                Didn't receive it?
                <a href="javascript:void(0)" id="fResendLink"
                   onclick="resendForgotOTP('${email}')">Resend OTP</a>
                <span id="fResendTimer" style="color:#aaa;font-size:12px;"></span>
            </p>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('fOtp0')?.focus(), 100);
    startForgotResendCountdown();
}

function fOtpInput(el, idx, email) {
    el.value = el.value.replace(/[^0-9]/g, '').slice(-1);
    document.getElementById('fOtpError').textContent = '';
    el.style.borderColor = el.value ? '#667eea' : '#ddd';
    if (el.value && idx < 3) document.getElementById('fOtp' + (idx + 1))?.focus();
    // Auto-verify when all 4 filled
    const otp = [0,1,2,3].map(i => document.getElementById('fOtp'+i)?.value||'').join('');
    if (otp.length === 4) setTimeout(() => verifyForgotOTP(email), 150);
}

function fOtpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 0)
        document.getElementById('fOtp' + (idx - 1))?.focus();
}

// Step 4: Verify the OTP
async function verifyForgotOTP(email) {
    const otp   = [0,1,2,3].map(i => document.getElementById('fOtp'+i)?.value||'').join('');
    const errEl = document.getElementById('fOtpError');
    const btn   = document.getElementById('fOtpVerifyBtn');

    if (otp.length < 4) {
        errEl.textContent = 'Please enter the complete 4-digit OTP.';
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Verifying...';
    errEl.textContent = '';
    [0,1,2,3].forEach(i => { const el = document.getElementById('fOtp'+i); if(el) el.disabled = true; });

    try {
        const res  = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_otp', email, otp, purpose: 'forgot_password' })
        });
        const data = await res.json();

        if (data.success) {
            // Flash green
            [0,1,2,3].forEach(i => {
                const el = document.getElementById('fOtp'+i);
                if(el) el.style.borderColor = '#27ae60';
            });
            setTimeout(() => {
                document.getElementById('forgotOTPModal')?.remove();
                showSetNewPasswordModal(email, data.reset_token);
            }, 400);
        } else {
            [0,1,2,3].forEach(i => {
                const el = document.getElementById('fOtp'+i);
                if(el) { el.style.borderColor = '#e74c3c'; el.disabled = false; el.value = ''; }
            });
            document.getElementById('fOtp0')?.focus();
            errEl.textContent = data.message || 'Invalid OTP. Please try again.';
            btn.disabled    = false;
            btn.textContent = '✅ Verify OTP';
        }
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        [0,1,2,3].forEach(i => { const el = document.getElementById('fOtp'+i); if(el) el.disabled = false; });
        btn.disabled    = false;
        btn.textContent = '✅ Verify OTP';
    }
}

// Step 5: Set new password modal
function showSetNewPasswordModal(email, resetToken) {
    const existing = document.getElementById('resetPassModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'resetPassModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">

            <div style="width:64px;height:64px;background:linear-gradient(135deg,#27ae60,#2ecc71);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;
                        margin:0 auto 16px;font-size:28px;">🔒</div>

            <h2 style="margin:0 0 8px;">Set New Password</h2>
            <p style="color:#888;font-size:14px;margin:0 0 24px;">OTP verified ✅ — Choose a strong new password.</p>

            <div style="text-align:left;margin-bottom:14px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;">New Password</label>
                <div style="position:relative;">
                    <input type="password" id="newPassword" placeholder="Minimum 6 characters"
                        style="width:100%;padding:12px 42px 12px 12px;border:2px solid #ddd;border-radius:10px;
                               font-size:15px;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#667eea'"
                        onblur="this.style.borderColor='#ddd'"
                        oninput="checkPasswordStrength(this.value)">
                    <span onclick="togglePwd('newPassword',this)"
                          style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:18px;user-select:none;">👁️</span>
                </div>
                <div id="strengthBar" style="height:4px;border-radius:4px;margin-top:8px;background:#eee;transition:all 0.3s;">
                    <div id="strengthFill" style="height:100%;border-radius:4px;width:0%;transition:all 0.3s;"></div>
                </div>
                <div id="strengthText" style="font-size:12px;margin-top:4px;color:#aaa;text-align:right;"></div>
            </div>

            <div style="text-align:left;margin-bottom:20px;">
                <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px;">Confirm Password</label>
                <div style="position:relative;">
                    <input type="password" id="confirmPassword" placeholder="Re-enter new password"
                        style="width:100%;padding:12px 42px 12px 12px;border:2px solid #ddd;border-radius:10px;
                               font-size:15px;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#667eea'"
                        onblur="this.style.borderColor='#ddd'"
                        onkeydown="if(event.key==='Enter') submitNewPassword('${email}','${resetToken}')">
                    <span onclick="togglePwd('confirmPassword',this)"
                          style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:18px;user-select:none;">👁️</span>
                </div>
            </div>

            <div id="resetError" style="color:#e74c3c;font-size:13px;min-height:18px;margin-bottom:12px;"></div>

            <button onclick="submitNewPassword('${email}','${resetToken}')"
                id="resetBtn" class="btn btn-primary btn-block">
                🔒 Reset Password
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('newPassword')?.focus(), 100);
}

// Password strength checker
function checkPasswordStrength(val) {
    const fill = document.getElementById('strengthFill');
    const text = document.getElementById('strengthText');
    if (!fill || !text) return;

    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
        { pct: '0%',   color: '#eee',    label: '' },
        { pct: '25%',  color: '#e74c3c', label: 'Weak' },
        { pct: '50%',  color: '#e67e22', label: 'Fair' },
        { pct: '75%',  color: '#f1c40f', label: 'Good' },
        { pct: '100%', color: '#27ae60', label: 'Strong' },
    ];
    const lvl = levels[Math.min(score, 4)];
    fill.style.width      = lvl.pct;
    fill.style.background = lvl.color;
    text.style.color      = lvl.color;
    text.textContent      = lvl.label;
}

// Toggle password visibility
function togglePwd(id, icon) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.type  = inp.type === 'password' ? 'text' : 'password';
    icon.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

// Step 6: Submit new password
async function submitNewPassword(email, resetToken) {
    const newPwd     = document.getElementById('newPassword')?.value;
    const confirmPwd = document.getElementById('confirmPassword')?.value;
    const errEl      = document.getElementById('resetError');
    const btn        = document.getElementById('resetBtn');

    errEl.textContent = '';

    if (!newPwd || newPwd.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.'; return;
    }
    if (newPwd !== confirmPwd) {
        errEl.textContent = 'Passwords do not match.'; return;
    }

    btn.disabled    = true;
    btn.textContent = 'Resetting...';

    try {
        const res  = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'reset_password',
                email,
                reset_token: resetToken,
                password: newPwd
            })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('resetPassModal')?.remove();
            showToast('🎉 Password reset successfully! Please log in.', 'success');
            setTimeout(() => goToPage('login'), 800);
        } else {
            errEl.textContent = data.message || 'Reset failed. Please try again.';
            btn.disabled    = false;
            btn.textContent = '🔒 Reset Password';
        }
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        btn.disabled    = false;
        btn.textContent = '🔒 Reset Password';
    }
}

// Resend OTP for forgot password
async function resendForgotOTP(email) {
    const link  = document.getElementById('fResendLink');
    if (!link || link.style.pointerEvents === 'none') return;

    link.style.pointerEvents = 'none';
    link.style.color = '#ccc';
    [0,1,2,3].forEach(i => { const el = document.getElementById('fOtp'+i); if(el) el.value = ''; });
    document.getElementById('fOtpError').textContent = '';
    document.getElementById('fOtp0')?.focus();

    try {
        const res  = await fetch(`${API_URL}/otp.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_otp', email, purpose: 'forgot_password' })
        });
        const data = await res.json();
        if (data.success) {
            showToast('New OTP sent to ' + email);
            startForgotResendCountdown();
        } else {
            showToast(data.message || 'Failed to resend OTP', 'error');
            link.style.pointerEvents = '';
            link.style.color = '#667eea';
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
        link.style.pointerEvents = '';
        link.style.color = '#667eea';
    }
}

function startForgotResendCountdown() {
    const link  = document.getElementById('fResendLink');
    const timer = document.getElementById('fResendTimer');
    if (!link || !timer) return;
    link.style.pointerEvents = 'none';
    link.style.color = '#ccc';
    let secs = 60;
    const iv = setInterval(() => {
        secs--;
        timer.textContent = ` (${secs}s)`;
        if (secs <= 0) {
            clearInterval(iv);
            timer.textContent = '';
            link.style.pointerEvents = '';
            link.style.color = '#667eea';
        }
    }, 1000);
}

// ────────────────────────────────────────────────────────────────────────────
