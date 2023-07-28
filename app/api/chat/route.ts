import { kv } from '@vercel/kv'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi } from 'openai-edge'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'

export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.TENNR_API_KEY
})

const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  try{
    const json = await req.json()
    const { messages, previewToken } = json
    const userId = (await auth())?.user.id
  
    if (!userId) {
      return new Response('Unauthorized', {
        status: 401
      })
    }
  
    if (previewToken) {
      configuration.apiKey = previewToken
    }
  

    // const res = await openai.createChatCompletion({
    //   model: 'gpt-3.5-turbo',
    //   messages,
    //   temperature: 0.7,
    //   stream: true
    // })

    const agentId = "64c3f8fef6d0bcb0babc757a"
    const agentUrl = "http://localhost:4000"
    const streamIt = true

    const response = await fetch(agentUrl + '/api/v1/workflow/run', {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Authorization: `api-key ${process.env.TENNR_API_KEY}`
      },
      body: JSON.stringify({
        agentId: agentId,
        input: messages[messages.length-1].content,
        stream: streamIt,
        messages: messages
      })
    })

    const responseText = await response.text();
    
    const messageArr = responseText.split("\n\n")
      .filter(message => message.startsWith("data:"))
      .map(message => message.slice("data: ".length));

    console.log("messageArr: ", messageArr, "\n\n")

    const combinedMessages = messageArr.join('');
    console.log("combined messages: ", combinedMessages, "\n\n");

    // Removing the unwanted part
    const cleanedMessages = combinedMessages.replace('{"sources":[]}', '').trim();
    console.log("cleaned messages: ", cleanedMessages, "\n\n");

    const responseStream = arrayToStream([cleanedMessages]);




    // const testStream = new ReadableStream({
    //   start(controller) {
    //     controller.enqueue(new TextEncoder().encode("test"));
    //     controller.close();
    //   }
    // });
    
    // return new StreamingTextResponse(testStream);
    

    // const resp = await response.json()
    // console.log("resp json: ", resp, "\n\n")
    // const respText = await resp.output
    // console.log("response text: ", respText, "\n\n")

    //const responseStream = stringToStream(respText)

  
    // const stream = OpenAIStream(response, {
    //   async onCompletion(completion) {
    //     const title = json.messages[0].content.substring(0, 100)
    //     const id = json.id ?? nanoid()
    //     const createdAt = Date.now()
    //     const path = `/chat/${id}`
    //     const payload = {
    //       id,
    //       title,
    //       userId,
    //       createdAt,
    //       path,
    //       messages: [
    //         ...messages,
    //         {
    //           content: completion,
    //           role: 'assistant'
    //         }
    //       ]
    //     }
    //     await kv.hmset(`chat:${id}`, payload)
    //     await kv.zadd(`user:chat:${userId}`, {
    //       score: createdAt,
    //       member: `chat:${id}`
    //     })
    //   }
    // })
  
    return new StreamingTextResponse(responseStream)
  } catch (e) {
    console.error(e)
  }
  
}

function stringToStream(response: string) {
  return new ReadableStream({
      start(controller) {
          controller.enqueue(new TextEncoder().encode(response));
          controller.close();
      }
  });
}


function arrayToStream(array: string[]) {
  let currentIndex = 0;

  return new ReadableStream({
    pull(controller) {
      if (currentIndex >= array.length) {
        controller.close();
      } else {
        // Append a newline and enqueue the message as is, without JSON.stringify
        const text = array[currentIndex] + "\n";
        controller.enqueue(new TextEncoder().encode(text));
        currentIndex++;
      }
    }
  });
}

function joinMessages(messages: string[]) {
  let combinedMessages = messages.join(" ");
  combinedMessages = combinedMessages.replace(/"{|}"|"{|}"|"{|}"|"\{"sources":\[\]\}"/g, '');
  combinedMessages = combinedMessages.replace(' {"sources":[]}', '');
  return combinedMessages;
}
