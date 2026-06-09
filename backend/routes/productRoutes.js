console.log("✅ PRODUCT ROUTES LOADED");


const express = require("express");

const mongoose = require("mongoose");

const Product = require("../models/Product");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();


// ======================================
// ALLOWED CATEGORIES
// ======================================
const ALLOWED_CATEGORIES = [

    "snacks",

    "premium",

    "combo",

    "gift",

    "healthy"
];


// ======================================
// HELPER
// ======================================
const isValidObjectId = (id) => {

    return mongoose.Types.ObjectId.isValid(id);
};


// ======================================
// GET ALL PRODUCTS
// ======================================
router.get(

    "/",

    async (req, res) => {

        try {

            const products = await Product.find({

                isActive: true
            })

                .sort({

                    createdAt: -1
                });


            return res.status(200).json({

                success: true,

                count: products.length,

                products
            });

        } catch (error) {

            console.error(

                "GET PRODUCTS ERROR:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch products"
            });
        }
    }
);


// ======================================
// GET SINGLE PRODUCT
// ======================================
router.get(

    "/:id",

    async (req, res) => {

        try {

            const { id } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid product ID"
                });
            }


            const product =
                await Product.findById(id);


            if (!product) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found"
                });
            }


            return res.status(200).json({

                success: true,

                product
            });

        } catch (error) {

            console.error(

                "GET PRODUCT ERROR:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch product"
            });
        }
    }
);


// ======================================
// CREATE PRODUCT
// ======================================
router.post(

    "/",

    protect,

    async (req, res) => {

        try {

            let {

                name,

                price,

                stock,

                category,

                description,

                image
            } = req.body;


            // ======================================
            // CLEAN INPUTS
            // ======================================
            name = name?.trim();

            description =
                description?.trim() || "";

            category =
                category?.trim().toLowerCase();

            image =
                image?.trim() || "";


            // ======================================
            // VALIDATION
            // ======================================
            if (!name) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Product name is required"
                });
            }


            if (
                price === undefined ||
                price === null
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Product price is required"
                });
            }


            if (
                Number(price) < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid product price"
                });
            }


            if (
                stock &&
                Number(stock) < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid stock quantity"
                });
            }


            if (
                category &&
                !ALLOWED_CATEGORIES.includes(category)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid product category"
                });
            }


            // ======================================
            // CREATE PRODUCT
            // ======================================
            const product =
                await Product.create({

                    name,

                    price:
                        Number(price),

                    stock:
                        Number(stock || 0),

                    category:
                        category || "snacks",

                    description,

                    image
                });


            return res.status(201).json({

                success: true,

                message:
                    "Product created successfully",

                product
            });

        } catch (error) {

            console.error(

                "CREATE PRODUCT ERROR:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to create product"
            });
        }
    }
);


// ======================================
// UPDATE PRODUCT
// ======================================
router.put(

    "/:id",

    protect,

    async (req, res) => {

        try {

            const { id } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid product ID"
                });
            }


            const updatedProduct =
                await Product.findByIdAndUpdate(

                    id,

                    req.body,

                    {

                        new: true,

                        runValidators: true
                    }
                );


            if (!updatedProduct) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found"
                });
            }


            return res.status(200).json({

                success: true,

                message:
                    "Product updated successfully",

                product:
                    updatedProduct
            });

        } catch (error) {

            console.error(

                "UPDATE PRODUCT ERROR:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to update product"
            });
        }
    }
);


// ======================================
// DELETE PRODUCT
// ======================================
router.delete(

    "/:id",

    protect,

    async (req, res) => {

        try {

            const { id } = req.params;


            if (!isValidObjectId(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid product ID"
                });
            }


            const deletedProduct =
                await Product.findByIdAndDelete(id);


            if (!deletedProduct) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found"
                });
            }


            return res.status(200).json({

                success: true,

                message:
                    "Product deleted successfully"
            });

        } catch (error) {

            console.error(

                "DELETE PRODUCT ERROR:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete product"
            });
        }
    }
);


// ======================================
// EXPORT
// ======================================
module.exports = router;