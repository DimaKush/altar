import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }
    
    const indexerApiUrl = process.env.INDEXER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://134-209-152-255.sslip.io/api';
    
    const response = await fetch(`${indexerApiUrl}/superbles/${address}`);
    
    if (!response.ok) {
      throw new Error(`Indexer API returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Data from indexer:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching superbles deployments:', error);
    return NextResponse.json({ error: "Failed to fetch deployment data" }, { status: 500 });
  }
} 