require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');




// middleware

app.use(cors());
app.use(express.json());


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
        await client.connect();

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


        // stats or analytics 
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
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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