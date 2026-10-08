import { NextResponse } from 'next/server'
import { generateSignature, getCloudinaryApiKey, getCloudinaryName } from '@/lib/cloudinary'

export async function POST(request: Request) {
  try {
    const { params } = await request.json()
    const signature = generateSignature(params)
    
    return NextResponse.json({
      signature,
      apiKey: getCloudinaryApiKey(),
      cloudName: getCloudinaryName(),
    })
  } catch (error) {
    console.error('[cloudinary sign]', error)
    return NextResponse.json({ error: 'Failed to sign request' }, { status: 500 })
  }
}
