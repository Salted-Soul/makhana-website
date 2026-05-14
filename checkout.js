// =======================
// 🔥 PRODUCTION SAFE CHECKOUT
// =======================

const API = "http://https://makhana-website.onrender.com/api";

const STATE = {
    finalAmount: 0,
    loading: false,
    selectedPaymentMode: "upi",
    razorpayInstance: null
};

const DEBUG = true;


// =======================
// SAFE DOM
// =======================
function el(id){
    return document.getElementById(id);
}

function safeText(element, value){
    if(element){
        element.innerText = value;
    }
}


// =======================
// LOGGER
// =======================
function log(...args){
    if(DEBUG){
        console.log(...args);
    }
}


// =======================
// NOTIFIER
// =======================
function notify(message){
    if(typeof showToast === "function"){
        showToast(message);
    }else{
        alert(message);
    }
}


// =======================
// SAFE TOKEN
// =======================
function getToken(){
    return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        ""
    );
}


// =======================
// SAFE FETCH
// =======================
async function safeFetch(url, options = {}){

    try{

        const token = getToken();

        const response = await fetch(url, {
            credentials: "include",

            headers: {
                "Content-Type": "application/json",

                ...(token && {
                    Authorization: `Bearer ${token}`
                }),

                ...(options.headers || {})
            },

            ...options
        });

        let data = {};

        try{
            data = await response.json();
        }catch(err){}

        return {
            ok: response.ok,
            status: response.status,
            data
        };

    }catch(error){

        console.error("FETCH ERROR:", error);

        return {
            ok: false,
            status: 500,
            data: {
                success: false,
                message: "Network error"
            }
        };
    }
}


// =======================
// VALIDATION
// =======================
function validate(name, phone, address){

    if(!name || !phone || !address){
        return "All fields required";
    }

    if(!/^[0-9]{10}$/.test(phone)){
        return "Invalid phone number";
    }

    return null;
}


// =======================
// AUTHENTICATED USER
// =======================
async function getUser(){

    try{

        const result = await safeFetch(API + "/auth/check");

        if(!result.ok){
            return null;
        }

        return result.data.user || null;

    }catch(error){

        console.error("USER FETCH ERROR:", error);

        return null;
    }
}


// =======================
// LOAD CART SUMMARY
// =======================
async function loadSummary(){

    try{

        const user = await getUser();

        if(!user){

            notify("Please login first");

            window.location.href = "login.html";

            return;
        }

        const result = await safeFetch(
            API + "/cart/" + user._id
        );

        if(!result.ok){

            throw new Error(
                result.data.message || "Cart fetch failed"
            );
        }

        const items =
            result.data.items ||
            result.data.cart?.items ||
            [];

        const container = el("order-items");

        if(!container){
            return;
        }

        container.innerHTML = "";

        let total = 0;

        if(items.length === 0){

            container.innerHTML =
            "<h3>Cart Empty 😢</h3>";

            return;
        }

        items.forEach(item => {

            const itemTotal =
                (item.price || 0) *
                (item.quantity || 0);

            total += itemTotal;

            container.innerHTML += `
                <div class="item-row">
                    <span>
                        ${item.name} × ${item.quantity}
                    </span>

                    <span>
                        ₹${itemTotal}
                    </span>
                </div>
            `;
        });

        STATE.finalAmount = total;

        safeText(
            el("final-total"),
            `₹${total}`
        );

    }catch(error){

        console.error("LOAD SUMMARY ERROR:", error);

        notify("Failed to load cart ❌");
    }
}


// =======================
// UPI
// =======================
function getUpiInput(){

    return (
        el("upiId")?.value.trim() ||
        "success@razorpay"
    );
}


// =======================
// RESET
// =======================
function resetBtn(){

    const btn = el("checkoutBtn");

    if(btn){

        btn.disabled = false;

        btn.innerText = "Place Order";
    }

    STATE.loading = false;

    STATE.razorpayInstance = null;
}


// =======================
// COD ORDER
// =======================
async function createCODOrder({
    name,
    phone,
    address
}){

    try{

        const result = await safeFetch(
            API + "/order/place",
            {
                method: "POST",

                body: JSON.stringify({
                    name,
                    phone,
                    address
                })
            }
        );

        console.log("COD RESPONSE:", result);

        if(!result.ok){

            throw new Error(
                result.data.message ||
                "Order failed"
            );
        }

        await safeFetch(
            API + "/cart/clear",
            {
                method: "POST"
            }
        );

        window.location.href =
        `order-success.html?orderId=${
            result.data.orderId
        }`;

    }catch(error){

        console.error(
            "COD ORDER ERROR:",
            error
        );

        notify(
            error.message ||
            "Order failed ❌"
        );

        resetBtn();
    }
}


// =======================
// RAZORPAY OPTIONS
// =======================
function buildRazorpayOptions({
    data,
    name,
    phone,
    upiId,
    status
}){

    return {

        key: data.key,

        amount: data.amount * 100,

        currency: "INR",

        name: "Salted Soul",

        description: "Secure Payment",

        order_id: data.orderId,

        method: {
    upi: true,
    card: true,
    netbanking: true,
    wallet: true
},

upi: {
    flow: "intent"
},

config: {
    display: {

        blocks: {

            upi: {
                name: "UPI Payment",
                instruments: [
                    {
                        method: "upi"
                    }
                ]
            },

            cards: {
                name: "Cards",
                instruments: [
                    {
                        method: "card"
                    }
                ]
            },

            netbanking: {
                name: "Net Banking",
                instruments: [
                    {
                        method: "netbanking"
                    }
                ]
            },

            wallets: {
                name: "Wallets",
                instruments: [
                    {
                        method: "wallet"
                    }
                ]
            }
        },

        sequence: [
            "block.upi",
            "block.cards",
            "block.netbanking",
            "block.wallets"
        ],

        preferences: {
            show_default_blocks: false
        }
    }
},
        prefill: {
            name,
            contact: phone,
            email: "support@saltedsoul.com"
        },

        notes: {
            upi: upiId
        },

        handler: async function(response){

            try{

                if(status){
                    status.innerText =
                    "Verifying payment...";
                }

                const verifyResult =
                await safeFetch(
                    API + "/order/verify",
                    {
                        method: "POST",

                        body: JSON.stringify({

                            ...response,

                            name,
                            phone,

                            address:
                            el("address")?.value.trim()
                        })
                    }
                );

                if(!verifyResult.ok){

                    throw new Error(
                        verifyResult.data.message ||
                        "Verification failed"
                    );
                }

                await safeFetch(
                    API + "/cart/clear",
                    {
                        method: "POST"
                    }
                );

                window.location.href =
                `order-success.html?orderId=${
                    verifyResult.data.orderId
                }`;

            }catch(error){

                console.error(
                    "VERIFY ERROR:",
                    error
                );

                notify(
                    error.message ||
                    "Payment verification failed"
                );

                resetBtn();
            }
        },

        modal: {

            ondismiss: function(){

                log("Razorpay closed");

                resetBtn();

                if(status){
                    status.innerText =
                    "Payment cancelled";
                }
            }
        },

        theme: {
            color: "#2e7d32"
        }
    };
}


// =======================
// MAIN FLOW
// =======================
async function placeOrder(){

    if(STATE.loading){

        log("Duplicate click blocked");

        return;
    }

    STATE.loading = true;

    const btn = el("checkoutBtn");

    const status = el("statusText");

    if(btn){

        btn.disabled = true;

        btn.innerText = "Processing...";
    }

    try{

        const name =
            el("name")?.value.trim();

        const phone =
            el("phone")?.value.trim();

        const address =
            el("address")?.value.trim();

        const payment =
            el("payment")?.value;

        const validationError =
            validate(
                name,
                phone,
                address
            );

        if(validationError){

            notify(validationError);

            return resetBtn();
        }

        // ===================
        // COD FLOW
        // ===================
        if(payment === "cod"){

            return await createCODOrder({
                name,
                phone,
                address
            });
        }

        // ===================
        // ONLINE PAYMENT
        // ===================
        if(typeof Razorpay === "undefined"){

            notify(
                "Razorpay SDK failed to load"
            );

            return resetBtn();
        }

        if(status){

            status.innerText =
            "Opening secure payment...";
        }

        const orderResult =
        await safeFetch(
            API + "/order/create-order",
            {
                method: "POST"
            }
        );

        if(!orderResult.ok){

            throw new Error(
                orderResult.data.message ||
                "Failed to create payment order"
            );
        }

        const options =
        buildRazorpayOptions({

            data: orderResult.data,

            name,

            phone,

            upiId: getUpiInput(),

            status
        });

        console.log(
            "RAZORPAY OPTIONS:",
            options
        );

        const rzp = new Razorpay(options);

        STATE.razorpayInstance = rzp;

        rzp.on(
            "payment.failed",
            function(response){

                console.error(
                    "PAYMENT FAILED:",
                    response
                );

                notify(
                    response.error?.description ||
                    "Payment failed ❌"
                );

                resetBtn();
            }
        );

        rzp.open();

    }catch(error){

        console.error(
            "PLACE ORDER ERROR:",
            error
        );

        notify(
            error.message ||
            "Checkout failed ❌"
        );

        resetBtn();
    }
}


// =======================
// INIT
// =======================
document.addEventListener(
    "DOMContentLoaded",
    function(){

        loadSummary();

        const btn = el("checkoutBtn");

        if(btn){

            btn.addEventListener(
                "click",
                placeOrder
            );
        }
    }
);