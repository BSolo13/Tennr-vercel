import { kv } from '@vercel/kv'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi } from 'openai-edge'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'

export const runtime = 'edge'

const configuration = new Configuration({
  //apiKey: 'ASStn8eNtkg87W5wemGhcMfOPxJ8/hyVaabGZ0tmsj8=' local version
  apiKey: process.env.TENNR_API_KEY
})

const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  try {
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

    // Authorization: `api-key ASStn8eNtkg87W5wemGhcMfOPxJ8/hyVaabGZ0tmsj8=` local version
    //const agentId = '64c5709065736e592c4b67cf' local version
    const agentId = '644b3fbae8f5dfe23bd06482'
    //const agentUrl = 'http://localhost:4000' local version
    const agentUrl = 'https://agent.tennr.com'
    var streamIt = true

    const response = await fetch(agentUrl + '/api/v1/workflow/run', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `api-key ${process.env.TENNR_API_KEY}` //gv8pzQgsLyTInP4mO02VSkMdA0zxsL97iRkAMw33NRU=`
      },
      body: JSON.stringify({
        agentId: agentId,
        input: messages[messages.length - 1].content,
        stream: streamIt,
        messages: messages
      })
    })

    let responseStream
    if (streamIt) {
      const responseText = await response.text()

      const messageArr = responseText
        .split('\n\n')
        .filter(message => message.startsWith('data:'))
        .map(message => message.slice('data: '.length))

      const combinedMessages = messageArr.join('')

      // Removing the unwanted part
      const cleanedMessages = combinedMessages
        .replace(/{"sources":\[.*\]}/, '')
        .trim()

      const processedMessages = createWordArray(cleanedMessages)
      responseStream = arrayToStream(processedMessages)
      console.log('final product for streaming: ', processedMessages)
    } else {
      const responseJson = JSON.parse(await response.text())
      const outputText = responseJson.output // Extract the output text.
      responseStream = stringToStream(outputText)
      console.log('Final product for non-streaming: ', outputText)
    }

    return new StreamingTextResponse(responseStream)
  } catch (e) {
    console.error(e)
  }
}

function stringToStream(response: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(response))
      controller.close()
    }
  })
}

function arrayToStream(array: string[]) {
  let currentIndex = 0

  return new ReadableStream({
    pull(controller) {
      if (currentIndex >= array.length) {
        controller.close()
      } else {
        // Append a newline and enqueue the message as is, without JSON.stringify
        const text = array[currentIndex] + '\n'
        controller.enqueue(new TextEncoder().encode(text))
        currentIndex++
      }
    }
  })
}

function createWordArray(text: string): string[] {
  const wordArray = text.split(' ')
  return wordArray
}
