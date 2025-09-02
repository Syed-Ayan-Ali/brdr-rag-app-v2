import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/Logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const level = searchParams.get('level') || 'all';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');

    const options = {
      startDate,
      endDate,
      limit,
      ...(category !== 'all' && { category: category as any }),
      ...(level !== 'all' && { level: level as any })
    };

    // Fetch different types of logs based on category
    let logs: any[] = [];
    let crawlLogs: any[] = [];
    let apiLogs: any[] = [];
    let llmLogs: any[] = [];

    if (category === 'all' || category === 'crawler') {
      crawlLogs = await logger.getCrawlLogs(options);
    }

    if (category === 'all' || category === 'api') {
      apiLogs = await logger.getAPILogs(options);
    }

    if (category === 'all' || category === 'llm') {
      llmLogs = await logger.getLLMLogs(options);
    }

    if (category === 'all') {
      logs = await logger.getAuditTrail(options);
    }

    return NextResponse.json({
      logs,
      crawlLogs,
      apiLogs,
      llmLogs,
      total: logs.length + crawlLogs.length + apiLogs.length + llmLogs.length
    });

  } catch (error) {
    console.error('Error fetching audit trail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    );
  }
} 