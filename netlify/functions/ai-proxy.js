exports.handler = async (event) => {
  if(event.httpMethod === 'OPTIONS'){
    return {statusCode:200,headers:{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'Content-Type,x-api-key,anthropic-version,anthropic-beta',
      'Access-Control-Allow-Methods':'POST,OPTIONS'
    },body:''};
  }
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if(!ANTHROPIC_KEY){
    return {statusCode:500,headers:{'Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({error:'API key not configured'})};
  }
  try{
    const body = JSON.parse(event.body||'{}');
    const resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version':'2023-06-01',
      },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    return {
      statusCode: resp.status,
      headers:{
        'Content-Type':'application/json',
        'Access-Control-Allow-Origin':'*'
      },
      body: JSON.stringify(data)
    };
  }catch(e){
    return {statusCode:500,headers:{'Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({error:e.message})};
  }
};
