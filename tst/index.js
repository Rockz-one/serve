const axios  = require('axios')   // easy http requests
const moment = require('moment')  // format time

let failed  =0                    // num requests failed
let succeded=[]                   // {timeToFirstByte,timeToLastByte}
let avgTimeToFirstByte =0
let avgTimeToLastByte  =0
let errors             =[]

async function test(num){
    const result = await axios.get('http://localhost:8000/node_modules').catch((err)=>{
        failed++
        errors.push(err)
        return
    })
    if (result){
        succeded++
    }
}

async function main(){
    await Promise.all(new Array(1000).fill(0).map(
        (index) => test(index)
    ))
    console.log(JSON.stringify(errors,null,2))
    console.log(`${failed} failed, ${succeded} succeded`)
}
main()
