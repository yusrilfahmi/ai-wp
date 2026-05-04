'use client'

import { useState, useEffect } from 'react'
import { getJadwal, FixtureData } from '@/app/actions/get-jadwal'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Trophy, Search, Loader2 } from 'lucide-react'

export default function JadwalPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [fixtures, setFixtures] = useState<FixtureData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchJadwal = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const data = await getJadwal(dateStr)
        setFixtures(data)
      } catch (err: any) {
        setError(err.message || 'Gagal memuat jadwal pertandingan')
      } finally {
        setIsLoading(false)
      }
    }

    fetchJadwal()
  }, [selectedDate])

  // Group fixtures by league
  const groupedFixtures = fixtures.reduce((acc, fixture) => {
    const leagueName = `${fixture.league.name} - ${fixture.league.country}`
    if (!acc[leagueName]) {
      acc[leagueName] = {
        league: fixture.league,
        fixtures: []
      }
    }
    acc[leagueName].fixtures.push(fixture)
    return acc
  }, {} as Record<string, { league: FixtureData['league'], fixtures: FixtureData[] }>)

  // Filter by search query
  const filteredGroups = Object.entries(groupedFixtures)
    .map(([leagueName, group]) => {
      const filteredFixtures = group.fixtures.filter(fixture => {
        const searchLower = searchQuery.toLowerCase()
        return (
          fixture.teams.home.name.toLowerCase().includes(searchLower) ||
          fixture.teams.away.name.toLowerCase().includes(searchLower) ||
          leagueName.toLowerCase().includes(searchLower)
        )
      })
      return { leagueName, group: { ...group, fixtures: filteredFixtures } }
    })
    .filter(({ group }) => group.fixtures.length > 0)
    .sort((a, b) => {
      // Sort leagues alphabetically, could also prioritize popular leagues
      return a.leagueName.localeCompare(b.leagueName)
    })

  const formatMatchTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  }

  const handleSubDays = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  }

  const handleAddDays = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Jadwal Pertandingan
          </h1>
          <p className="text-gray-500 text-sm mt-1">Pantau jadwal sepak bola dari seluruh dunia</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari tim atau liga..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1 w-full sm:w-auto">
            <button 
              onClick={handleSubDays}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 font-medium text-gray-700 min-w-[140px] justify-center">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm">
                {selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <button 
              onClick={handleAddDays}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Memuat jadwal pertandingan...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center">
          <p className="font-medium mb-2">Terjadi Kesalahan</p>
          <p className="text-sm opacity-80">{error}</p>
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate))}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium text-lg">Tidak ada jadwal pertandingan</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery ? 'Coba gunakan kata kunci pencarian yang lain' : 'Tidak ada pertandingan untuk tanggal tersebut'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredGroups.map(({ leagueName, group }) => (
            <div key={leagueName} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                {group.league.logo ? (
                  <img src={group.league.logo} alt={group.league.name} className="w-6 h-6 object-contain" />
                ) : (
                  <Trophy className="w-5 h-5 text-yellow-500" />
                )}
                <h2 className="font-bold text-gray-800 uppercase tracking-wide text-sm">
                  {leagueName}
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {group.fixtures.map((fixture) => (
                  <div key={fixture.fixture.id} className="p-4 hover:bg-blue-50/30 transition-colors flex flex-col sm:flex-row items-center gap-4 sm:gap-6 group">
                    <div className="w-full sm:w-24 text-center sm:text-left flex flex-row sm:flex-col justify-center items-center gap-2 sm:gap-0 bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                      <span className="text-sm font-bold text-gray-900">{formatMatchTime(fixture.fixture.date)}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {fixture.fixture.status.short}
                      </span>
                    </div>

                    <div className="flex-1 w-full flex items-center justify-between gap-4">
                      <div className="flex-1 flex items-center justify-end gap-3">
                        <span className={`text-sm md:text-base font-medium ${fixture.teams.home.winner ? 'text-gray-900 font-bold' : 'text-gray-700'} text-right`}>
                          {fixture.teams.home.name}
                        </span>
                        {fixture.teams.home.logo && (
                          <img src={fixture.teams.home.logo} alt="" className="w-8 h-8 object-contain" />
                        )}
                      </div>

                      <div className="w-16 flex flex-col items-center justify-center">
                        <div className="px-3 py-1 bg-gray-100 rounded-md font-bold text-gray-800 tabular-nums">
                          {fixture.goals.home !== null && fixture.goals.away !== null ? (
                            `${fixture.goals.home} - ${fixture.goals.away}`
                          ) : (
                            'VS'
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex items-center justify-start gap-3">
                        {fixture.teams.away.logo && (
                          <img src={fixture.teams.away.logo} alt="" className="w-8 h-8 object-contain" />
                        )}
                        <span className={`text-sm md:text-base font-medium ${fixture.teams.away.winner ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                          {fixture.teams.away.name}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
