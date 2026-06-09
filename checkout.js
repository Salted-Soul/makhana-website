// ======================================
// CHECKOUT STATE
// ======================================
const CHECKOUT_STATE = {

    loading: false,

    finalAmount: 0,

    razorpayInstance: null,

    user: null
};


// ======================================
// DEBUG
// ======================================
const DEBUG =
    true;


// ======================================
// LOGGER
// ======================================
function log(...args) {

    if (DEBUG) {

        console.log(...args);
    }
}


// ======================================
// SAFE DOM
// ======================================
function el(id) {

    return document.getElementById(id);
}


// ======================================
// SAFE TEXT
// ======================================
function safeText(
    element,
    value
) {

    if (element) {

        element.innerText =
            value;
    }
}


// ======================================
// TOAST
// ======================================
function notify(
    message,
    type = "info"
) {

    if (
        typeof showToast ===
        "function"
    ) {

        showToast(
            message,
            type
        );

    } else {

        console.log(
            `${type.toUpperCase()}: ${message}`
        );

        alert(message);
    }
}


// ======================================
// VALIDATION
// ======================================
function validateCheckout({

    name,

    phone,

    address

}) {

    if (
        !name ||
        !phone ||
        !address
    ) {

        return "All fields are required";
    }


    if (
        !/^[0-9]{10}$/.test(phone)
    ) {

        return "Invalid phone number";
    }


    if (
        address.length < 10
    ) {

        return "Address too short";
    }


    return null;
}


// ======================================
// BUTTON CONTROL
// ======================================
function setLoading(
    loading
) {

    CHECKOUT_STATE.loading =
        loading;

    const btn =
        el("checkoutBtn");


    if (!btn) return;


    btn.disabled =
        loading;

    btn.innerText =
        loading
            ? "Processing..."
            : "Place Order";
}


// ======================================
// GET USER
// ======================================
async function getUser() {

    try {

        const response =
            await API.auth.check();


        console.log(
            "👤 USER RESPONSE:",
            response
        );


        if (
            response.success &&
            response.user
        ) {

            CHECKOUT_STATE.user =
                response.user;

            return response.user;
        }


        return null;

    } catch (err) {

        console.error(
            "❌ User fetch failed:",
            err
        );

        return null;
    }
}


// ======================================
// LOAD CART SUMMARY
// ======================================
async function loadSummary() {

    try {

        const user =
            await getUser();


        if (!user) {

            notify(
                "Please login first"
            );

            return setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 1000);
        }


        // ======================================
        // FIXED ROUTE
        // ======================================
        const response =
            await API.get(
                "/cart"
            );


        console.log(
            "🛒 CART RESPONSE:",
            response
        );


        if (
            !response.success
        ) {

            throw new Error(

                response.message ||

                "Failed to load cart"
            );
        }


        // ======================================
        // SAFE ITEMS
        // ======================================
        const items =
            response.items ||

            response.cart?.items ||

            [];


        const container =
            el("order-items");


        if (!container) {

            console.warn(
                "⚠ order-items container missing"
            );

            return;
        }


        container.innerHTML =
            "";


        // ======================================
        // EMPTY CART
        // ======================================
        if (
            !items.length
        ) {

            container.innerHTML = `

                <h3>
                    Cart Empty 😢
                </h3>
            `;

            safeText(
                el("final-total"),
                "₹0"
            );

            return;
        }


        let total = 0;


        items.forEach(item => {

            const qty =
                Number(item.quantity) || 1;

            const price =
                Number(item.price) || 0;

            const itemTotal =
                qty * price;

            total += itemTotal;


            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "item-row";


            row.innerHTML = `

                <span>
                    ${item.name} × ${qty}
                </span>

                <span>
                    ₹${itemTotal}
                </span>
            `;


            container.appendChild(
                row
            );
        });


        CHECKOUT_STATE.finalAmount =
            total;


        safeText(

            el("final-total"),

            `₹${total}`
        );


        log(
            "🛒 Total:",
            total
        );

    } catch (err) {

        console.error(
            "❌ Summary load failed:",
            err
        );

        notify(
            "Failed to load cart"
        );
    }
}


// ======================================
// CREATE COD ORDER
// ======================================
async function createCODOrder({

    name,

    phone,

    address

}) {

    try {

        const response =
            await API.post(

                "/order/place",

                {

                    name,

                    phone,

                    address,

                    paymentMethod:
                        "COD"
                }
            );


        if (
            !response.success
        ) {

            throw new Error(

                response.message ||

                "COD order failed"
            );
        }


        await API.post(
            "/cart/clear"
        );


        notify(
            "Order placed successfully",
            "success"
        );


        setLoading(false);


        setTimeout(() => {

            window.location.href =

                `order-success.html?orderId=${response.orderId || response.order?._id}`;

        }, 1000);

    } catch (err) {

        console.error(
            "❌ COD ERROR:",
            err
        );

        notify(
            err.message ||
            "COD failed"
        );

        setLoading(false);
    }
}


// ======================================
// VERIFY PAYMENT
// ======================================
async function verifyPayment({

    razorpay_order_id,

    razorpay_payment_id,

    razorpay_signature,

    customer
}) {

    return await API.post(

        "/payment/verify",

        {

            razorpay_order_id,

            razorpay_payment_id,

            razorpay_signature,

            ...customer
        }
    );
}


// ======================================
// CREATE PAYMENT ORDER
// ======================================
async function createPaymentOrder() {

    return await API.post(
        "/payment/create-order"
    );
}


// ======================================
// BUILD RAZORPAY OPTIONS
// ======================================

function buildRazorpayOptions({

    paymentData,

    customer

}) {

    return {

        key:
            paymentData.key,

        amount:
            paymentData.order.amount,

        currency:
            "INR",

        name:
            "Salted Soul",

        description:
            "Premium Healthy Snacks",

        image:
            "images/logo.jpeg",

        order_id:
            paymentData.order.id,


        // ======================================
        // CUSTOMER PREFILL
        // ======================================
        prefill: {

            name:
                customer.name,

            contact:
                customer.phone,

            email:
                CHECKOUT_STATE.user?.email || ""
        },


        // ======================================
        // NOTES
        // ======================================
        notes: {

            customerName:
                customer.name
        },


        // ======================================
        // THEME
        // ======================================
        theme: {

            color: "#2e7d32"
        },


        // ======================================
        // ENABLE ALL PAYMENT METHODS
        // ======================================
        method: {

            upi: true,

            card: true,

            netbanking: true,

            wallet: true,

            emi: true,

            paylater: true
        },


        // ======================================
        // UPI SETTINGS
        // ======================================
        upi: {

            flow: "collect"
        },


        // ======================================
        // PAYMENT SUCCESS
        // ======================================
        handler: async function(
            response
        ) {

            try {

                notify(
                    "Verifying payment..."
                );


                const verifyResult =

                    await verifyPayment({

                        ...response,

                        customer
                    });


                if (
                    !verifyResult.success
                ) {

                    throw new Error(

                        verifyResult.message ||

                        "Verification failed"
                    );
                }


                await API.post(
                    "/cart/clear"
                );


                notify(
                    "Payment successful ✅",
                    "success"
                );


                setTimeout(() => {

                    window.location.href =

                        `order-success.html?orderId=${verifyResult.order?._id || verifyResult.orderId}`;

                }, 1200);

            } catch (err) {

                console.error(
                    "❌ VERIFY ERROR:",
                    err
                );

                notify(
                    err.message ||
                    "Payment verification failed"
                );

                setLoading(false);
            }
        },


        // ======================================
        // MODAL CLOSE
        // ======================================
        modal: {

            ondismiss: function() {

                log(
                    "⚠ Razorpay closed"
                );

                notify(
                    "Payment cancelled"
                );

                setLoading(false);
            }
        }
    };
}
// ======================================
// ONLINE PAYMENT FLOW
// ======================================
async function handleOnlinePayment(
    customer
) {

    try {

        if (
            typeof Razorpay ===
            "undefined"
        ) {

            throw new Error(
                "Razorpay SDK failed to load"
            );
        }


        if (
            CHECKOUT_STATE.finalAmount <= 0
        ) {

            throw new Error(
                "Cart total is invalid"
            );
        }


        const paymentData =
            await createPaymentOrder();


        console.log(
            "💳 PAYMENT DATA:",
            paymentData
        );


        if (
            !paymentData.success
        ) {

            throw new Error(

                paymentData.message ||

                "Failed to create payment order"
            );
        }


        const options =
            buildRazorpayOptions({

                paymentData,

                customer
            });


        const rzp =
            new Razorpay(options);


        CHECKOUT_STATE.razorpayInstance =
            rzp;


        rzp.on(

            "payment.failed",

            function(response) {

                console.error(

                    "❌ PAYMENT FAILED:",

                    response
                );

                notify(

                    response.error
                        ?.description ||

                    "Payment failed"
                );

                setLoading(false);
            }
        );


        rzp.open();

    } catch (err) {

        console.error(
            "❌ ONLINE PAYMENT ERROR:",
            err
        );

        notify(
            err.message ||
            "Payment failed"
        );

        setLoading(false);
    }
}


// ======================================
// MAIN CHECKOUT FLOW
// ======================================
async function placeOrder() {

    if (
        CHECKOUT_STATE.loading
    ) {

        log(
            "⚠ Duplicate click blocked"
        );

        return;
    }


    setLoading(true);


    try {

        const customer = {

            name:
                el("name")
                    ?.value
                    ?.trim(),

            phone:
                el("phone")
                    ?.value
                    ?.trim(),

            address:
                el("address")
                    ?.value
                    ?.trim()
        };


        const paymentMethod =
            el("payment")
                ?.value || "online";


        const validationError =

            validateCheckout(
                customer
            );


        if (validationError) {

            notify(
                validationError
            );

            return setLoading(false);
        }


        // COD
        if (
            paymentMethod === "cod"
        ) {

            return await createCODOrder(
                customer
            );
        }


        // ONLINE
        await handleOnlinePayment(
            customer
        );

    } catch (err) {

        console.error(
            "❌ CHECKOUT ERROR:",
            err
        );

        notify(
            err.message ||
            "Checkout failed"
        );

        setLoading(false);
    }
}


// ======================================
// INIT
// ======================================
document.addEventListener(

    "DOMContentLoaded",

    () => {

        try {

            loadSummary();


            const btn =
                el("checkoutBtn");


            if (btn) {

                btn.addEventListener(

                    "click",

                    placeOrder
                );
            }


            console.log(
                "✅ Checkout Ready"
            );

        } catch (err) {

            console.error(
                "❌ INIT ERROR:",
                err
            );
        }
    }
);


// ======================================
// GLOBAL EXPORTS
// ======================================
window.placeOrder =
    placeOrder;