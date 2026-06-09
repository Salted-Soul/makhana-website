    console.log(
        "🔐 AUTH MODULE INITIALIZING..."
    );


    // ======================================
    // DOM READY
    // ======================================
    document.addEventListener(

        "DOMContentLoaded",

        () => {

            // ======================================
            // CONFIG
            // ======================================
            const REQUEST_TIMEOUT = 15000;

            const DEBUG =
                window.location.hostname ===
                "localhost";


            // ======================================
            // SAFE LOGGER
            // ======================================
            const log = (
                ...args
            ) => {

                if (DEBUG) {

                    console.log(...args);
                }
            };


            // ======================================
            // SAFE DOM HELPERS
            // ======================================
            function getEl(id) {

                const el =
                    document.getElementById(id);

                if (!el) {

                    console.warn(
                        `⚠ Missing element: ${id}`
                    );
                }

                return el;
            }


            // ======================================
            // SAFE REDIRECT
            // ======================================
            function safeRedirect(path) {

                if (!path) return;

                window.location.replace(path);
            }


            // ======================================
            // SAFE EVENT BINDING
            // ======================================
            function safeAddEvent(

                element,

                event,

                handler

            ) {

                if (!element) {

                    console.warn(
                        "⚠ Cannot attach event to missing element"
                    );

                    return;
                }

                element.addEventListener(
                    event,
                    handler
                );
            }


            // ======================================
            // GLOBAL ERROR HANDLER
            // ======================================
            window.addEventListener(

                "error",

                (e) => {

                    console.error(
                        "🔥 Global Error:",
                        e.message
                    );
                }
            );


            // ======================================
            // OFFLINE DETECTION
            // ======================================
            window.addEventListener(

                "offline",

                () => {

                    showMessage(

                        "You are offline. Please check your internet connection."
                    );
                }
            );


            // ======================================
            // ONLINE DETECTION
            // ======================================
            window.addEventListener(

                "online",

                () => {

                    showMessage(

                        "Internet connection restored.",

                        "success"
                    );
                }
            );


            // ======================================
            // MESSAGE SYSTEM
            // ======================================
            function showMessage(

                message,

                type = "error"

            ) {

                const box =
                    getEl("messageBox");

                if (!box) return;


                box.innerText =
                    message;


                box.className =
                    `message-box ${type}`;


                box.style.display =
                    "block";


                clearTimeout(
                    box.hideTimeout
                );


                box.hideTimeout =
                    setTimeout(

                        () => {

                            box.style.display =
                                "none";

                        },

                        4000
                    );
            }


            // ======================================
            // LOADING SYSTEM
            // ======================================
            function toggleLoading(

                button,

                loading

            ) {

                if (!button) return;


                if (loading) {

                    button.disabled = true;

                    button.dataset.loading =
                        "true";

                    button.style.opacity =
                        "0.7";

                    button.style.cursor =
                        "not-allowed";

                    button.innerText =
                        "Please wait...";

                } else {

                    button.disabled = false;

                    button.dataset.loading =
                        "false";

                    button.style.opacity =
                        "1";

                    button.style.cursor =
                        "pointer";

                    button.innerText =

                        button.dataset.original ||

                        "Submit";
                }
            }


            // ======================================
            // VALIDATORS
            // ======================================
            function isValidEmail(
                email
            ) {

                return /\S+@\S+\.\S+/.test(
                    email
                );
            }


            function isStrongPassword(
                password
            ) {

                return (
                    typeof password ===
                        "string" &&

                    password.length >= 6
                );
            }


            // ======================================
            // SAFE STORAGE
            // ======================================
            const Session = {

                setUser(user) {

                    try {

                        localStorage.setItem(

                            "user",

                            JSON.stringify(user)
                        );

                    } catch (err) {

                        console.error(
                            "❌ Storage save failed:",
                            err
                        );
                    }
                },

                getUser() {

                    try {

                        return JSON.parse(

                            localStorage.getItem(
                                "user"
                            )
                        );

                    } catch {

                        return null;
                    }
                },

                clear() {

                    localStorage.removeItem(
                        "user"
                    );

                    sessionStorage.clear();
                }
            };


            // ======================================
            // AUTH CHECK
            // ======================================
            async function checkAuth() {

                try {

                    const response =

                        await API.auth.check();


                    if (
                        response.success &&
                        response.user
                    ) {

                        Session.setUser(
                            response.user
                        );

                        log(
                            "✅ Authenticated:",
                            response.user
                        );

                        return response.user;
                    }


                    return null;

                } catch (err) {

                    console.error(
                        "❌ Auth check failed:",
                        err
                    );

                    return null;
                }
            }


            // ======================================
            // SIGNUP
            // ======================================
            async function signup(e) {

                e.preventDefault();


                const btn =
                    getEl("signupBtn");


                if (
                    btn?.dataset.loading ===
                    "true"
                ) {

                    return;
                }


                if (btn) {

                    btn.dataset.original =
                        "Create Account";
                }


                const name =
                    getEl("name")
                        ?.value
                        ?.trim();


                const email =
                    getEl("email")
                        ?.value
                        ?.trim();


                const password =
                    getEl("password")
                        ?.value
                        ?.trim();


                // VALIDATION
                if (

                    !name ||

                    !email ||

                    !password

                ) {

                    return showMessage(

                        "All fields are required"
                    );
                }


                if (
                    !isValidEmail(email)
                ) {

                    return showMessage(
                        "Invalid email address"
                    );
                }


                if (
                    !isStrongPassword(
                        password
                    )
                ) {

                    return showMessage(

                        "Password must be at least 6 characters"
                    );
                }


                try {

                    toggleLoading(
                        btn,
                        true
                    );


                    const response =

                        await API.auth.signup({

                            name,

                            email,

                            password
                        });


                    if (
                        !response.success
                    ) {

                        throw new Error(

                            response.message ||

                            "Signup failed"
                        );
                    }


                    if (
                        response.user
                    ) {

                        Session.setUser(
                            response.user
                        );
                    }


                    showMessage(

                        "Account created successfully!",

                        "success"
                    );


                    setTimeout(

                        () => {

                            safeRedirect(
                                "index.html"
                            );

                        },

                        1200
                    );

                } catch (err) {

                    console.error(
                        "❌ Signup Error:",
                        err
                    );

                    showMessage(

                        err.message ||

                        "Signup failed"
                    );

                } finally {

                    toggleLoading(
                        btn,
                        false
                    );
                }
            }


            // ======================================
            // LOGIN
            // ======================================
            async function login(e) {

                e.preventDefault();

                log(
                    "🚀 LOGIN INITIATED"
                );


                const btn =
                    getEl("loginBtn");


                if (
                    btn?.dataset.loading ===
                    "true"
                ) {

                    return;
                }


                if (btn) {

                    btn.dataset.original =
                        "Login";
                }


                const email =
                    getEl("email")
                        ?.value
                        ?.trim();


                const password =
                    getEl("password")
                        ?.value
                        ?.trim();


                // VALIDATION
                if (
                    !email ||
                    !password
                ) {

                    return showMessage(

                        "All fields are required"
                    );
                }


                try {

                    toggleLoading(
                        btn,
                        true
                    );


                    const response =

                        await API.auth.login({

                            email,

                            password
                        });


                    if (
                        !response.success
                    ) {

                        throw new Error(

                            response.message ||

                            "Login failed"
                        );
                    }


                    if (
                        response.user
                    ) {

                        Session.setUser(
                            response.user
                        );

                        log(
                            "✅ Session saved"
                        );
                    }


                    showMessage(

                        "Login successful!",

                        "success"
                    );


                    setTimeout(

                        () => {

                            safeRedirect(
                                "index.html"
                            );

                        },

                        1000
                    );

                } catch (err) {

                    console.error(
                        "❌ Login Error:",
                        err
                    );

                    showMessage(

                        err.message ||

                        "Login failed"
                    );

                } finally {

                    toggleLoading(
                        btn,
                        false
                    );
                }
            }


            // ======================================
            // LOGOUT
            // ======================================
            async function logout() {

                try {

                    await API.auth.logout();

                    Session.clear();

                    log(
                        "✅ Session cleared"
                    );

                    safeRedirect(
                        "login.html"
                    );

                } catch (err) {

                    console.error(
                        "❌ Logout Error:",
                        err
                    );

                    showMessage(
                        "Logout failed"
                    );
                }
            }


            // ======================================
            // ATTACH EVENTS
            // ======================================
            safeAddEvent(

                getEl("loginForm"),

                "submit",

                login
            );


            safeAddEvent(

                getEl("signupForm"),

                "submit",

                signup
            );


            // ======================================
            // ENTER KEY SUPPORT
            // ======================================
            document.addEventListener(

                "keypress",

                (e) => {

                    if (
                        e.key !== "Enter"
                    ) {

                        return;
                    }


                    const loginForm =
                        getEl("loginForm");

                    const signupForm =
                        getEl("signupForm");


                    if (loginForm) {

                        loginForm.dispatchEvent(

                            new Event(
                                "submit"
                            )
                        );
                    }


                    if (signupForm) {

                        signupForm.dispatchEvent(

                            new Event(
                                "submit"
                            )
                        );
                    }
                }
            );


            // ======================================
            // AUTH GUARD
            // ======================================
            (async () => {

                const user =
                    await checkAuth();


                const authPages = [

                    "login.html",

                    "signup.html"
                ];


                const protectedPages = [

                    "cart.html",

                    "checkout.html",

                    "orders.html",

                    "profile.html",

                    "wishlist.html"
                ];


                const currentPage =

                    window.location.pathname
                        .split("/")
                        .pop();


                const isAuthPage =
                    authPages.includes(
                        currentPage
                    );


                const isProtectedPage =
                    protectedPages.includes(
                        currentPage
                    );


                log(
                    "🔐 AUTH GUARD:",
                    {
                        user,
                        currentPage
                    }
                );


                // PROTECTED PAGE
                if (
                    !user &&
                    isProtectedPage
                ) {

                    console.warn(
                        "⛔ Login required"
                    );

                    return safeRedirect(
                        "login.html"
                    );
                }


                // ALREADY LOGGED IN
                if (
                    user &&
                    isAuthPage
                ) {

                    console.warn(
                        "⚠ Already logged in"
                    );

                    return safeRedirect(
                        "index.html"
                    );
                }

            })();


            // ======================================
            // GLOBAL EXPORTS
            // ======================================
            window.signup =
                signup;

            window.login =
                login;

            window.logout =
                logout;


            console.log(
                "✅ AUTH SYSTEM READY"
            );
        }
    );