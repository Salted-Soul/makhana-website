const express = require("express");

const router = express.Router();

const Wishlist =
    require("../models/Wishlist");

const Product =
    require("../models/Product");

const { protect } =
    require("../middleware/authMiddleware");


// ======================================
// TEST ROUTE
// ======================================

router.get(
    "/test",
    (req, res) => {

        res.json({

            success: true,

            message: "Wishlist route working"
        });
    }
);


// ======================================
// GET USER WISHLIST
// ======================================

router.get(
    "/",

    protect,

    async (req, res) => {

        try {

            let wishlist =
                await Wishlist.findOne({

                    user: req.user.id

                }).populate("products");


            if (!wishlist) {

                wishlist =
                    await Wishlist.create({

                        user: req.user.id,

                        products: []
                    });
            }

            res.json({

                success: true,

                wishlist
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Failed to fetch wishlist"
            });
        }
    }
);


// ======================================
// ADD PRODUCT TO WISHLIST
// ======================================

router.post(
    "/add/:productId",

    protect,

    async (req, res) => {

        try {

            const product =
                await Product.findById(
                    req.params.productId
                );

            if (!product) {

                return res.status(404).json({

                    success: false,

                    message: "Product not found"
                });
            }

            let wishlist =
                await Wishlist.findOne({

                    user: req.user.id
                });

            if (!wishlist) {

                wishlist =
                    await Wishlist.create({

                        user: req.user.id,

                        products: []
                    });
            }

            const alreadyExists =
                wishlist.products.includes(
                    req.params.productId
                );

            if (!alreadyExists) {

                wishlist.products.push(
                    req.params.productId
                );

                await wishlist.save();
            }

            res.json({

                success: true,

                message: "Added to wishlist"
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Failed to add wishlist"
            });
        }
    }
);


// ======================================
// REMOVE PRODUCT FROM WISHLIST
// ======================================

router.delete(
    "/remove/:productId",

    protect,

    async (req, res) => {

        try {

            const wishlist =
                await Wishlist.findOne({

                    user: req.user.id
                });

            if (!wishlist) {

                return res.status(404).json({

                    success: false,

                    message: "Wishlist not found"
                });
            }

            wishlist.products =
                wishlist.products.filter(

                    (product) =>

                        product.toString() !==
                        req.params.productId
                );

            await wishlist.save();

            res.json({

                success: true,

                message: "Removed from wishlist"
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: "Failed to remove wishlist item"
            });
        }
    }
);

module.exports = router;