'use server'

export interface FixtureData {
  fixture: {
    id: number;
    date: string;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export async function getJadwal(date: string) {
  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': 'e2531c033addb4ad82e5c108364c0141',
        'x-rapidapi-host': 'v3.football.api-sports.io'
      },
      next: {
        revalidate: 60 * 5 // Cache for 5 mins
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response as FixtureData[];
  } catch (error: any) {
    console.error('Error fetching jadwal:', error);
    throw new Error(error.message || 'Failed to fetch jadwal');
  }
}
