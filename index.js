const express = require('express')
const app = express()
const {Client} = require('pg')
const connectionString = "postgres://localhost:5432/glexport_db"
//DB CONNECTION
const client = new Client({connectionString: connectionString})
client.connect((err) => {
  if (err) {
    console.error('connection error', err.stack)
  } else {
    console.log('connected to glexport_db🦍')
  }
})
//ROUTES
app.get('/', (req, res) => res.send('Hello World!'))

app.get('/api/v1/shipments', (req, res) => {
  if (!req.query.company_id) {
    res.status(422).json({
      errors: ['company_id is required']
    })
  }
  client.query(`
    SELECT
        s.id "shipment_id",
        s."name",
        s.international_transportation_mode,
        s.international_departure_date,
        sp.quantity,
        p.id "product_id",
        p.sku,
        p.description,
        count_table.active_shipment_count
      FROM shipments s
      JOIN shipment_products sp
        ON s.id = sp.shipment_id
      JOIN products p
        ON sp.product_id = p.id
      JOIN (select p.id, count(*) as "active_shipment_count"
        from products p
        join shipment_products sp
        on sp.product_id = p.id
        group by p.id) count_table
        ON count_table.id =  p.id
      WHERE s.company_id = $1 ;`, [req.query.company_id]
    ).then(result => {
      let data = result.rows;
      //Filtering
      if (req.query.international_transportation_mode) {
        data = data.filter( (ele) => {
          return ele.international_transportation_mode === req.query.international_transportation_mode
        })
      }
      //Processing
      let json = {
        records: []
      }
      let shipmentStore = {};
      data.forEach(shipmentObj => {
        if (!shipmentStore[shipmentObj.shipment_id]) {
          shipmentStore[shipmentObj.shipment_id] = {
            id: shipmentObj.shipment_id,
            name: shipmentObj.name,
            date: shipmentObj.international_departure_date,
            products: []
          }
        }
        shipmentStore[shipmentObj.shipment_id].products.push({
          quantity: shipmentObj.quantity,
          id: shipmentObj.product_id,
          sku: shipmentObj.sku,
          description: shipmentObj.description,
          active_shipment_count: parseInt(shipmentObj.active_shipment_count)
        })
      })
      for (id in shipmentStore) {
        json.records.push(shipmentStore[id])
      }
      //Sorting
      if (!!req.query["sort"] && req.query.direction === 'asc') {
        json.records = json.records.sort( (a, b) => {
          return Date.parse(a.date) - Date.parse(b.date)
        })
      } else if (!!req.query["sort"] && req.query.direction === 'desc') {
        json.records = json.records.sort( (a, b) => {
          return Date.parse(b.date) - Date.parse(a.date)
        })
      }
      for (var i = 0; i < json.records.length; i++) {
        delete json.records[i].date
      }
      //Pagination
      if (req.query.per) {
        console.log("per and page trigger");
        json.records = json.records.slice((req.query.page * req.query.per) - 2, req.query.page * req.query.per)
      } else if (req.query.page) {
        console.log("page trigger");
        json.records = json.records.slice((req.query.page * 4) - 4, req.query.page * 4)
      } else {
        json.records = json.records.slice(0,4)
      }
      res.json(json)
    }).catch(err => {
      res.json({err: err})
    })
})
app.get('/api/v1/raw', (req, res) => {
  client.query(`
      SELECT
        s.id "shipment_id",
        s."name",
        s.international_transportation_mode,
        s.international_departure_date,
        sp.quantity,
        p.id "product_id",
        p.sku,
        p.description
      FROM shipments s
      JOIN shipment_products sp
        ON s.id = sp.shipment_id
      JOIN products p
        ON sp.product_id = p.id
      WHERE s.company_id = $1;
    `, [req.query.company_id]).then(result => {
    let data = result.rows;
    res.json(data)
  }).catch(err => {
    res.json({err: err})
  })
})

app.listen(3000, () => console.log('Example app 😝 listening on port 3000!'))
