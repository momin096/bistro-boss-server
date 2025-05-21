require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: axios } = require('axios');

// const formData = require('form-data');
// const Mailgun = require('mailgun.js');

// const mailgun = new Mailgun(formData);


// const mg = mailgun.client({
//     username: 'api',
//     key: process.env.MAIL_GUN_API_KEY, // e.g., 'key-1234567890abcdef'
// });

// module.exports = mg;


// SSL COMMARZZ ---------------------------------------------------
// Store ID: bistr682c0082a8cfd
// Store Password(API / Secret Key): bistr682c0082a8cfd@ssl


// Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)



// Store name: testbistr5a39
// Registered URL: www.bistroboss.com
// Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
// Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
// Validation API(Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php

// You may check our plugins available for multiple carts and libraries: https://github.com/sslcommerz

// ssl commarz steps
/**
 * 1. initiate payment 
 * 2. 
 */

// middleware

app.use(cors());
app.use(express.json());
app.use(express.urlencoded())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tp3bo.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();  

        const menuCollection = client.db('bistroDB').collection('menu');
        const reviewCollection = client.db('bistroDB').collection('reviews');
        const cartCollection = client.db('bistroDB').collection('carts');
        const userCollection = client.db('bistroDB').collection('users');
        const paymentCollection = client.db('bistroDB').collection('payments');


        // JWT token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: '1h' });
            res.send({ token });
        })


        // verifyJWT middleware
        const verifyJWT = (req, res, next) => {
            // console.log('inside verify token', req?.headers?.authorization);
            if (!req.headers.authorization) {
                res.status(401).send({ message: 'Forbidden access' })
            }

            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'Forbidden access' })
            }

            jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Forbidden access' })
                }
                req.decoded = decoded;
                next();
            })
        }
        const verifyAdmin = async (req, res, next) => {
            const email = req?.decoded?.email;
            const query = { email };
            // const user = await payment.findOne(query);
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(401).send({ message: 'Forbidden access' })

            }

            next();
        }
        // users collection

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const result = await userCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email);
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "UnAuthorize Access" })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);

            let admin = false;
            // if (!user) {
            //     return res.status(404).send({ message: 'User not found' })
            // }

            admin = user.role === 'admin';
            res.send({ admin })

        })

        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user not exist
            // you can do this many ways (1. email unique, 2. upsert 3.simple checking)
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists', insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        // Menu collection
        app.get('/menu', async (req, res) => {
            const query = {};
            const result = await menuCollection.find(query).toArray();
            res.send(result);
        })

        // add a menu 
        app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
            const menu = req.body;
            const result = await menuCollection.insertOne(menu);
            res.send(result);
        })

        // delete a menu
        app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;

            // need adjust object id
            const query = {
                _id: id
            };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        // get a menu
        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            // need adjust object id
            const query = { _id: id };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        // update a menu 
        app.patch('/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            // need adjust object id
            const query = { _id: id };

            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image,
                }
            }
            const result = await menuCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const query = {};
            const result = await reviewCollection.find(query).toArray();
            res.send(result);
        })

        // carts collection 
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([]);
            }
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })



        // payment related api
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            // delete each item from the cart 
            query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };
            // not verified
            // mg.messages.create(process.env.MAIL_SENDING_DOMAIN, {
            //     from: 'Mailgun Sandbox <postmaster@sandbox5c3501ff6b46453eba921485e5fe35ed.mailgun.org>',
            //     to: ['momin09609@gmail.com'],
            //     subject: 'Bistro Boss Order Confirmation',
            //     text: 'Testing MailGun Awesomeness!',
            //     html: `
            //     <div>
            //         <h2>Thank You for your order</h2>
            //         <h4>Your Transaction id: <strong>${payment.transactionId}</h4>
            //         <P>We would like to get your feedback about the food</p>
            //     </div>
            //     `
            // })
            //     .then(msg => console.log(msg)) // success
            //     .catch(err => console.error(err)); // error

            const deleteResult = await cartCollection.deleteMany(query);
            res.send({ paymentResult, deleteResult })
        })


        app.get('/payments/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            const query = { email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })
        // ssl payment initiate 
        app.post('/create-ssl-payment', async (req, res) => {
            const payment = req.body
            // console.log('payment Info', payment);

            const trxid = new ObjectId().toString()

            payment.transactionId = trxid

            const initiate = {
                store_id: 'bistr682c0082a8cfd',
                store_passwd: 'bistr682c0082a8cfd@ssl',
                total_amount: payment.price,
                currency: 'BDT',
                tran_id: trxid, // use unique tran_id for each api call
                success_url: 'http://localhost:5000/success-payment',
                fail_url: 'http://localhost:5173/fail',
                cancel_url: 'http://localhost:5173/cancel',
                ipn_url: 'http://localhost:5000/ipn-success-payment',
                shipping_method: 'Courier',
                product_name: 'Computer.',
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: 'Customer Name',
                cus_email: `${payment?.email}`,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: '01711111111',
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            }

            const iniResponse = await axios({
                url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
                method: 'POST',
                data: initiate,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            })

            const saveData = await paymentCollection.insertOne(payment)
            const gatewayUrl = iniResponse?.data?.GatewayPageURL

            console.log('gatewayUrl', gatewayUrl, saveData);
            res.send({ gatewayUrl })


        })

        // payment success 
        app.post('/success-payment', async (req, res) => {
            // success payment data
            const paymentSuccess = req.body
            // console.log('payment success info', paymentSuccess);

            // validation
            const { data } = await axios.get(`https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSuccess.val_id}&store_id=bistr682c0082a8cfd&store_passwd=bistr682c0082a8cfd@ssl&format=json`)

            if (data.status !== 'VALID') {
                res.send({ message: 'Invalid Payment' })
            }

            // update the payment
            const updatePayment = await paymentCollection.updateOne({ transactionId: data.tran_id }, {
                $set: { status: 'success' }
            })

            console.log(updatePayment);

            const payment = await paymentCollection.findOne({ transactionId: data.tran_id })
            console.log(payment);

            query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };

            const deleteResult = await cartCollection.deleteMany(query);
            console.log(deleteResult, 'deleteresult');
            res.redirect('http://localhost:5173/success')


        })


        // stats or analytics  -------------------------------------
        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItems = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            // this is not the best way 
            // const payments = await paymentCollection.find().toArray();
            // const revenue = payments.reduce((total, payment) => total + payment.price, 0)

            // best way ->>
            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;


            res.send({ users, menuItems, orders, revenue })
        })


        // using aggregate pipeline 
        app.get('/order-stats', async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: '$foodIds'
                }, {
                    $lookup: {
                        from: 'menu',
                        localField: 'foodIds',
                        foreignField: '_id',
                        as: 'foodItems'
                    }
                }, {
                    $unwind: '$foodItems'
                }, {
                    $group: {
                        _id: '$foodItems.category',
                        quantity: {
                            $sum: 1
                        },
                        revenue: { $sum: '$foodItems.price' }
                    }
                }, {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        revenue: '$revenue',
                    }
                }
            ]).toArray();

            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Boss Is Running!')
})

app.listen(port, () => {
    console.log(`Boss is running on port: ${port}`)
})