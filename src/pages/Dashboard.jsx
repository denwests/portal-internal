import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  supabase,
} from "../supabase";

import Sidebar from "../components/Sidebar";
import RevenueTrendChart from "../components/RevenueTrendChart";
import { MonthPicker } from "../components/PeriodPicker";

import "./Dashboard.css";


/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {
  return `Rp ${Number(
    value || 0
  ).toLocaleString("id-ID")}`;
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {

  const employeeRole =
    localStorage.getItem(
      "employeeRole"
    ) || "Staff";


  const canManageNotes =
    [
      "Founder",
      "Administrator",
    ].includes(
      employeeRole
    );


  /* =======================================================
     DATE
  ======================================================= */

  const today = new Date();


  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    today.getMonth()
  );


  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    today.getFullYear()
  );


  /* =======================================================
     DASHBOARD DATA
  ======================================================= */

  const [
    totalCustomer,
    setTotalCustomer,
  ] = useState(0);


  const [
    totalBooking,
    setTotalBooking,
  ] = useState(0);


  const [
    totalRevenue,
    setTotalRevenue,
  ] = useState(0);


  const [
    monthlyRevenue,
    setMonthlyRevenue,
  ] = useState(
    Array(12).fill(0)
  );

  const [
    previousMonthlyRevenue,
    setPreviousMonthlyRevenue,
  ] = useState(
    Array(12).fill(0)
  );


  const [
    bookings,
    setBookings,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  /* =======================================================
     REMINDER NOTES
  ======================================================= */

  const [
    notes,
    setNotes,
  ] = useState([]);


  const [
    notesLoading,
    setNotesLoading,
  ] = useState(true);


  const [
    showNoteForm,
    setShowNoteForm,
  ] = useState(false);


  const [
    noteTitle,
    setNoteTitle,
  ] = useState(
    ""
  );


  const [
    noteDescription,
    setNoteDescription,
  ] = useState(
    ""
  );


  const [
    savingNote,
    setSavingNote,
  ] = useState(false);


  const [
    noteError,
    setNoteError,
  ] = useState(
    ""
  );


  /* =======================================================
     CALENDAR
  ======================================================= */

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    today.getMonth()
  );


  const [
    calendarYear,
    setCalendarYear,
  ] = useState(
    today.getFullYear()
  );


  const [
    selectedScheduleDay,
    setSelectedScheduleDay,
  ] = useState(null);


  const [
    selectedScheduleBooking,
    setSelectedScheduleBooking,
  ] = useState(null);


  /* =======================================================
     MONTH NAMES
  ======================================================= */

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];


  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  useEffect(() => {

    async function loadDashboard() {

      setLoading(true);


      /* ===================================================
         YEAR RANGE
      =================================================== */

      const yearStart =
        `${selectedYear}-01-01`;

      const previousYearStart =
        `${selectedYear - 1}-01-01`;


      const yearEnd =
        `${selectedYear + 1}-01-01`;


      /* ===================================================
         SELECTED MONTH RANGE
      =================================================== */

      const monthString =
        String(
          selectedMonth + 1
        ).padStart(
          2,
          "0"
        );


      const selectedMonthStart =
        `${selectedYear}-${monthString}-01`;


      let nextMonthYear =
        selectedYear;


      let nextMonth =
        selectedMonth + 2;


      if (
        nextMonth === 13
      ) {

        nextMonth = 1;

        nextMonthYear += 1;

      }


      const nextMonthString =
        String(
          nextMonth
        ).padStart(
          2,
          "0"
        );


      const selectedMonthEnd =
        `${nextMonthYear}-${nextMonthString}-01`;


      /* ===================================================
         CUSTOMER DATA
      =================================================== */

      const {
        data: customerYearData,
        error: customerYearError,
      } =
        await supabase
          .from("customers")
          .select(
            "id, date"
          )
          .gte(
            "date",
            yearStart
          )
          .lt(
            "date",
            yearEnd
          );


      if (
        customerYearError
      ) {

        console.error(
          "CUSTOMER ERROR:",
          customerYearError
        );

      }


      const customers =
        customerYearData ||
        [];


      const selectedMonthCustomers =
        customers.filter(
          (customer) => {

            if (!customer.date) {
              return false;
            }

            return (
              customer.date >=
                selectedMonthStart &&
              customer.date <
                selectedMonthEnd
            );

          }
        );


      setTotalCustomer(
        selectedMonthCustomers.length
      );


      /* ===================================================
         REVENUE FROM TRANSACTIONS
         revenue_date is the booking/event date used by Bookkeeping.
         Staff does not request finance data.
      =================================================== */

      if (
        employeeRole !==
        "Staff"
      ) {

        const {
          data: transactionYearData,
          error: transactionYearError,
        } =
          await supabase
            .from("transactions")
            .select(
              "amount, revenue_date"
            )
            .gte(
              "revenue_date",
              previousYearStart
            )
            .lt(
              "revenue_date",
              yearEnd
            );


        if (
          transactionYearError
        ) {

          console.error(
            "TRANSACTION ERROR:",
            transactionYearError
          );

        }


        const transactions =
          transactionYearData ||
          [];

        const currentYearTransactions =
          transactions.filter(
            (transaction) =>
              transaction.revenue_date >= yearStart
          );

        const previousYearTransactions =
          transactions.filter(
            (transaction) =>
              transaction.revenue_date < yearStart
          );


        const selectedRevenue =
          currentYearTransactions
            .filter(
              (transaction) =>
                transaction.revenue_date &&
                transaction.revenue_date >=
                  selectedMonthStart &&
                transaction.revenue_date <
                  selectedMonthEnd
            )
            .reduce(
              (sum, transaction) =>
                sum +
                Number(
                  transaction.amount ||
                  0
                ),
              0
            );


        setTotalRevenue(
          selectedRevenue
        );


        const monthly =
          Array(12).fill(0);


        currentYearTransactions.forEach(
          (transaction) => {

            if (
              !transaction.revenue_date
            ) {
              return;
            }

            const monthIndex =
              Number(
                transaction.revenue_date.slice(
                  5,
                  7
                )
              ) - 1;

            if (
              monthIndex >= 0 &&
              monthIndex < 12
            ) {
              monthly[monthIndex] +=
                Number(
                  transaction.amount ||
                  0
                );
            }

          }
        );


        setMonthlyRevenue(
          monthly
        );

        const previousMonthly =
          Array(12).fill(0);

        previousYearTransactions.forEach(
          (transaction) => {
            if (!transaction.revenue_date) {
              return;
            }

            const monthIndex =
              Number(
                transaction.revenue_date.slice(5, 7)
              ) - 1;

            if (
              monthIndex >= 0 &&
              monthIndex < 12
            ) {
              previousMonthly[monthIndex] +=
                Number(
                  transaction.amount || 0
                );
            }
          }
        );

        setPreviousMonthlyRevenue(
          previousMonthly
        );

      } else {

        setTotalRevenue(0);
        setMonthlyRevenue(
          Array(12).fill(0)
        );
        setPreviousMonthlyRevenue(
          Array(12).fill(0)
        );

      }


      /* ===================================================
         BOOKING DATA
      =================================================== */

      const {
        data: bookingData,
        error: bookingError,
      } =
        await supabase
          .from("bookings")
          .select("*")
          .order(
            "booking_date",
            {
              ascending:
                true,
            }
          )
          .order(
            "start_time",
            {
              ascending:
                true,
            }
          );


      if (
        bookingError
      ) {

        console.error(
          "BOOKING ERROR:",
          bookingError
        );

      }


      const bookingList =
        bookingData ||
        [];


      /*
       * Dashboard schedule is operational-only:
       * - canceled bookings are hidden immediately
       * - booking dates before today are hidden automatically
       * Historical records remain stored in Supabase.
       */
      const todayDate =
        new Date();

      const todayString =
        `${todayDate.getFullYear()}-${String(
          todayDate.getMonth() + 1
        ).padStart(
          2,
          "0"
        )}-${String(
          todayDate.getDate()
        ).padStart(
          2,
          "0"
        )}`;


      const activeBookingList =
        bookingList.filter(
          (
            booking
          ) => {

            if (
              !booking.booking_date
            ) {
              return false;
            }


            return (
              booking.booking_date >=
                todayString &&
              booking.status !==
                "Canceled"
            );

          }
        );


      setBookings(
        activeBookingList
      );


      /* ===================================================
         UPCOMING BOOKINGS
      =================================================== */

      const now =
        new Date();


      const selectedMonthBookings =
        activeBookingList.filter(
          (
            booking
          ) => {

            if (
              !booking.booking_date
            ) {
              return false;
            }


            return (
              booking.booking_date >=
                selectedMonthStart &&
              booking.booking_date <
                selectedMonthEnd
            );

          }
        );


      const upcomingBookings =
        selectedMonthBookings.filter(
          (
            booking
          ) => {

            if (
              !booking.booking_date
            ) {
              return false;
            }


            const bookingDate =
              new Date(
                `${booking.booking_date}T${
                  booking.start_time ||
                  "00:00:00"
                }`
              );


            return (
              bookingDate >=
              now
            );

          }
        );


      setTotalBooking(
        upcomingBookings.length
      );


      setLoading(false);

    }


    loadDashboard();

  }, [
    employeeRole,
    selectedMonth,
    selectedYear,
  ]);


  /* =======================================================
     LOAD REMINDER NOTES
  ======================================================= */

  const fetchNotes =
    async () => {

      setNotesLoading(true);
      setNoteError(
        ""
      );


      const {
        data,
        error,
      } = await supabase
        .from(
          "dashboard_notes"
        )
        .select(
          "id, title, description, created_by, created_at"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


      if (error) {

        console.error(
          "DASHBOARD NOTES ERROR:",
          error
        );

        setNotes([]);
        setNoteError(
          "Reminder belum dapat dimuat."
        );
        setNotesLoading(false);
        return;

      }


      setNotes(
        data || []
      );
      setNotesLoading(false);

    };


  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchNotes(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);


  const openNoteForm =
    () => {

      if (!canManageNotes) {
        return;
      }

      setNoteTitle(
        ""
      );
      setNoteDescription(
        ""
      );
      setNoteError(
        ""
      );
      setShowNoteForm(true);

    };


  const closeNoteForm =
    () => {

      if (savingNote) {
        return;
      }

      setShowNoteForm(false);
      setNoteError(
        ""
      );

    };


  const handleSaveNote =
    async (event) => {

      event.preventDefault();

      if (!canManageNotes) {
        return;
      }


      const cleanTitle =
        noteTitle.trim();

      const cleanDescription =
        noteDescription.trim();


      if (
        !cleanTitle ||
        !cleanDescription
      ) {

        setNoteError(
          "Judul dan deskripsi wajib diisi."
        );
        return;

      }


      setSavingNote(true);
      setNoteError(
        ""
      );


      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();


      const userId =
        sessionData?.session?.user?.id;


      if (
        sessionError ||
        !userId
      ) {

        setNoteError(
          "Sesi login tidak ditemukan. Silakan login kembali."
        );
        setSavingNote(false);
        return;

      }


      const {
        data,
        error,
      } = await supabase
        .from(
          "dashboard_notes"
        )
        .insert([
          {
            title: cleanTitle,
            description:
              cleanDescription,
            created_by:
              userId,
          },
        ])
        .select(
          "id, title, description, created_by, created_at"
        )
        .single();


      if (error) {

        console.error(
          "DASHBOARD NOTE INSERT ERROR:",
          error
        );

        setNoteError(
          error.message ||
          "Gagal menambahkan reminder."
        );
        setSavingNote(false);
        return;

      }


      setNotes(
        (current) => [
          data,
          ...current,
        ]
      );

      setSavingNote(false);
      setShowNoteForm(false);
      setNoteTitle(
        ""
      );
      setNoteDescription(
        ""
      );

    };


  const handleDeleteNote =
    async (note) => {

      if (
        !canManageNotes ||
        !note?.id
      ) {
        return;
      }


      const confirmed =
        window.confirm(
          `Hapus reminder "${note.title}"?`
        );


      if (!confirmed) {
        return;
      }


      const {
        error,
      } = await supabase
        .from(
          "dashboard_notes"
        )
        .delete()
        .eq(
          "id",
          note.id
        );


      if (error) {

        console.error(
          "DASHBOARD NOTE DELETE ERROR:",
          error
        );

        setNoteError(
          error.message ||
          "Gagal menghapus reminder."
        );
        return;

      }


      setNotes(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              note.id
          )
      );

    };


  const formatNoteDate =
    (value) => {

      if (!value) {
        return "";
      }

      return new Date(
        value
      ).toLocaleDateString(
        "id-ID",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );

    };


  /* =======================================================
     CALENDAR CELLS
  ======================================================= */

  const firstDay =
    new Date(
      calendarYear,
      calendarMonth,
      1
    ).getDay();


  const daysInMonth =
    new Date(
      calendarYear,
      calendarMonth + 1,
      0
    ).getDate();


  const calendarCells = [];


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    calendarCells.push(
      null
    );

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    calendarCells.push(
      day
    );

  }


  /* =======================================================
     GET BOOKINGS FOR DAY
  ======================================================= */

  const getBookingsForDay = (
    day
  ) => {

    if (!day) {
      return [];
    }


    return bookings.filter(
      (
        booking
      ) => {

        if (
          !booking.booking_date
        ) {
          return false;
        }


        const parts =
          booking.booking_date.split(
            "-"
          );


        if (
          parts.length !== 3
        ) {
          return false;
        }


        const bookingYear =
          Number(
            parts[0]
          );


        const bookingMonth =
          Number(
            parts[1]
          ) - 1;


        const bookingDay =
          Number(
            parts[2]
          );


        return (
          bookingDay === day &&
          bookingMonth ===
            calendarMonth &&
          bookingYear ===
            calendarYear
        );

      }
    );

  };


  const selectedScheduleBookings =
    selectedScheduleDay
      ? getBookingsForDay(selectedScheduleDay)
      : [];


  const formatScheduleDate = (day) => {

    if (!day) {
      return "-";
    }

    return new Date(
      calendarYear,
      calendarMonth,
      day
    ).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );

  };


  /* =======================================================
     CALENDAR NAVIGATION
  ======================================================= */

  const previousMonth = () => {

    if (
      calendarMonth === 0
    ) {

      setCalendarMonth(
        11
      );

      setCalendarYear(
        calendarYear - 1
      );

    } else {

      setCalendarMonth(
        calendarMonth - 1
      );

    }

  };


  const nextMonth = () => {

    if (
      calendarMonth === 11
    ) {

      setCalendarMonth(
        0
      );

      setCalendarYear(
        calendarYear + 1
      );

    } else {

      setCalendarMonth(
        calendarMonth + 1
      );

    }

  };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="dashboard-page">


      {/* =================================================
          SHARED SIDEBAR
      ================================================= */}

      <Sidebar
        activePage="dashboard"
      />


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="dashboard-main">


        {/* =================================================
            TOPBAR
        ================================================= */}

        {/* =================================================
            OVERVIEW
        ================================================= */}

        <section className="dashboard-overview">


          <div className="dashboard-section-heading">

            <div>

              <div className="dashboard-section-label">
                PLUNO STUDIO / OVERVIEW
              </div>

              <h2>
                Studio Performance
              </h2>

            </div>


            <div className="dashboard-performance-filter">
              <MonthPicker
                year={selectedYear}
                month={selectedMonth + 1}
                ariaLabel="Dashboard month and year"
                onChange={({ year, month }) => {
                  setSelectedYear(year);
                  setSelectedMonth(month - 1);
                }}
              />
            </div>

          </div>


          {/* =================================================
              STATS
          ================================================= */}

          <div className="dashboard-stats">


            {/* REVENUE */}

            <div className="dashboard-stat featured">

              <div className="dashboard-stat-label">
                GROSS REVENUE
              </div>

              <div className="dashboard-stat-value">

                {employeeRole ===
                "Staff"
                  ? "****"
                  : loading
                  ? "..."
                  : formatRupiah(
                      totalRevenue
                    )}

              </div>

              <div className="dashboard-stat-note">

                {
                  monthNames[
                    selectedMonth
                  ]
                }{" "}

                {
                  selectedYear
                }

              </div>

            </div>


            {/* CUSTOMERS */}

            <div className="dashboard-stat">

              <div className="dashboard-stat-label">
                CUSTOMERS
              </div>

              <div className="dashboard-stat-value">

                {loading
                  ? "..."
                  : totalCustomer}

              </div>

              <div className="dashboard-stat-note">

                {
                  monthNames[
                    selectedMonth
                  ]
                }{" "}

                {
                  selectedYear
                }

              </div>

            </div>


            {/* UPCOMING BOOKINGS */}

            <div className="dashboard-stat">

              <div className="dashboard-stat-label">
                UPCOMING BOOKINGS
              </div>

              <div className="dashboard-stat-value">

                {loading
                  ? "..."
                  : totalBooking}

              </div>

              <div className="dashboard-stat-note">

                {
                  monthNames[
                    selectedMonth
                  ]
                }{" "}

                {
                  selectedYear
                }

              </div>

            </div>

          </div>


          {/* =================================================
              LOWER GRID
          ================================================= */}

          <div className="dashboard-content-grid">


            <div className="dashboard-left-stack">


              {/* =================================================
                  REMINDER NOTES
              ================================================= */}

              <div className="dashboard-card dashboard-notes-card">

                <div className="dashboard-card-header">

                  <div>

                    <div className="dashboard-card-kicker">
                      NOTES
                    </div>

                    <h3>
                      Reminder Notes
                    </h3>

                  </div>


                  {canManageNotes && (

                    <button
                      type="button"
                      className="dashboard-note-add"
                      onClick={
                        openNoteForm
                      }
                    >
                      Add
                    </button>

                  )}

                </div>


                <div className="dashboard-notes-list">

                  {notesLoading ? (

                    <div className="dashboard-notes-empty">
                      Loading reminder...
                    </div>

                  ) : notes.length === 0 ? (

                    <div className="dashboard-notes-empty">
                      No reminder yet.
                    </div>

                  ) : (

                    notes.map(
                      (note) => (

                        <div
                          className="dashboard-note-item"
                          key={
                            note.id
                          }
                        >

                          <div className="dashboard-note-main">

                            <strong>
                              {note.title}
                            </strong>

                            <p>
                              {note.description}
                            </p>

                            <span>
                              {formatNoteDate(
                                note.created_at
                              )}
                            </span>

                          </div>


                          {canManageNotes && (

                            <button
                              type="button"
                              className="dashboard-note-delete"
                              onClick={() =>
                                handleDeleteNote(
                                  note
                                )
                              }
                            >
                              Delete
                            </button>

                          )}

                        </div>

                      )
                    )

                  )}

                </div>


                {noteError &&
                  !showNoteForm && (

                  <div className="dashboard-note-inline-error">
                    {noteError}
                  </div>

                )}

              </div>


              {/* =================================================
                  MONTHLY REVENUE
              ================================================= */}

              <div className="dashboard-card revenue-card">

              <div className="dashboard-card-header">

                <div>

                  <div className="dashboard-card-kicker">
                    REVENUE
                  </div>

                  <h3>
                    Monthly Revenue
                  </h3>

                </div>

                <span>
                  {
                    selectedYear
                  }
                </span>

              </div>


              <RevenueTrendChart
                current={monthlyRevenue}
                comparison={previousMonthlyRevenue}
                currentLabel={`${selectedYear}`}
                comparisonLabel={`${selectedYear - 1}`}
              />

            </div>


            </div>


            {/* =================================================
                BOOKING CALENDAR
            ================================================= */}

            <div className="dashboard-card booking-calendar-card">

              <div className="dashboard-card-header">

                <div>

                  <div className="dashboard-card-kicker">
                    BOOKING LIST
                  </div>

                  <h3>
                    Booking Schedule
                  </h3>

                </div>


                <Link
                  to="/booking"
                  className="dashboard-view-all"
                >
                  View all
                </Link>

              </div>


              {/* CALENDAR HEADER */}

              <div className="calendar-header">

                <button
                  type="button"
                  onClick={
                    previousMonth
                  }
                  aria-label="Previous month"
                >
                  ‹
                </button>


                <strong>

                  {
                    monthNames[
                      calendarMonth
                    ]
                  }{" "}

                  {
                    calendarYear
                  }

                </strong>


                <button
                  type="button"
                  onClick={
                    nextMonth
                  }
                  aria-label="Next month"
                >
                  ›
                </button>

              </div>


              {/* DAYS */}

              <div className="calendar-week">

                {[
                  "SUN",
                  "MON",
                  "TUE",
                  "WED",
                  "THU",
                  "FRI",
                  "SAT",
                ].map(
                  (
                    day
                  ) => (

                    <div
                      key={day}
                    >
                      {day}
                    </div>

                  )
                )}

              </div>


              {/* CALENDAR */}

              <div className="calendar-grid">

                {calendarCells.map(
                  (
                    day,
                    index
                  ) => {

                    const dayBookings =
                      getBookingsForDay(
                        day
                      );


                    const isToday =
                      day ===
                        today.getDate() &&
                      calendarMonth ===
                        today.getMonth() &&
                      calendarYear ===
                        today.getFullYear();


                    return (

                      <div
                        key={
                          index
                        }
                        className={`calendar-day ${
                          isToday
                            ? "today"
                            : ""
                        } ${
                          dayBookings.length
                            ? "has-booking"
                            : ""
                        } ${
                          day
                            ? "calendar-day-clickable"
                            : ""
                        }`}
                        role={day ? "button" : undefined}
                        tabIndex={day ? 0 : undefined}
                        onClick={() => {
                          if (!day) return;
                          setSelectedScheduleDay(day);
                          setSelectedScheduleBooking(null);
                        }}
                        onKeyDown={(event) => {
                          if (!day) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedScheduleDay(day);
                            setSelectedScheduleBooking(null);
                          }
                        }}
                      >

                        {day && (

                          <>

                            <div className="calendar-date">
                              {
                                day
                              }
                            </div>


                            {dayBookings
                              .slice(
                                0,
                                2
                              )
                              .map(
                                (
                                  booking,
                                  bookingIndex
                                ) => (

                                  <div
                                    className="calendar-booking"
                                    key={
                                      booking.id ||
                                      bookingIndex
                                    }
                                  >

                                    {
                                      booking.start_time
                                        ? booking.start_time.substring(
                                            0,
                                            5
                                          )
                                        : "--:--"
                                    }

                                    {" - "}

                                    {
                                      booking.package ||
                                      "Booking"
                                    }

                                  </div>

                                )
                              )}


                            {dayBookings.length >
                              2 && (

                              <div className="calendar-more">

                                +

                                {
                                  dayBookings.length -
                                  2
                                }{" "}

                                more

                              </div>

                            )}

                          </>

                        )}

                      </div>

                    );

                  }
                )}

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            BOOKING SCHEDULE DAY MODAL
        ================================================= */}

        {selectedScheduleDay && (

          <div
            className="dashboard-schedule-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedScheduleDay(null);
                setSelectedScheduleBooking(null);
              }
            }}
          >

            <div className="dashboard-schedule-modal">

              <div className="dashboard-schedule-modal-header">

                <div>
                  <div className="dashboard-card-kicker">
                    BOOKING SCHEDULE
                  </div>
                  <h3>{formatScheduleDate(selectedScheduleDay)}</h3>
                </div>

                <button
                  type="button"
                  className="dashboard-schedule-close"
                  onClick={() => {
                    setSelectedScheduleDay(null);
                    setSelectedScheduleBooking(null);
                  }}
                  aria-label="Close booking schedule"
                >
                  ×
                </button>

              </div>

              {!selectedScheduleBooking ? (

                <div className="dashboard-schedule-list">

                  {selectedScheduleBookings.length === 0 ? (
                    <div className="dashboard-schedule-empty">
                      No booking on this date.
                    </div>
                  ) : (
                    selectedScheduleBookings.map((booking, index) => (
                      <div
                        className="dashboard-schedule-row"
                        key={booking.id || index}
                      >
                        <div className="dashboard-schedule-copy">
                          <strong>{booking.customer_name || "Unnamed Customer"}</strong>
                          <span>{booking.package || "Booking"}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedScheduleBooking(booking)}
                        >
                          View
                        </button>
                      </div>
                    ))
                  )}

                </div>

              ) : (

                <div className="dashboard-schedule-detail">

                  <div className="dashboard-schedule-detail-grid">
                    <div>
                      <span>CUSTOMER</span>
                      <strong>{selectedScheduleBooking.customer_name || "-"}</strong>
                    </div>
                    <div>
                      <span>PACKAGE</span>
                      <strong>{selectedScheduleBooking.package || "-"}</strong>
                    </div>
                    <div>
                      <span>TIME</span>
                      <strong>
                        {selectedScheduleBooking.start_time
                          ? selectedScheduleBooking.start_time.substring(0, 5)
                          : "-"}
                      </strong>
                    </div>
                    <div>
                      <span>STATUS</span>
                      <strong>{selectedScheduleBooking.status || "-"}</strong>
                    </div>
                  </div>

                  <div className="dashboard-schedule-notes">
                    <span>DESCRIPTION</span>
                    <p>{selectedScheduleBooking.notes || "No description."}</p>
                  </div>

                  <div className="dashboard-schedule-detail-footer">
                    <button
                      type="button"
                      onClick={() => setSelectedScheduleBooking(null)}
                    >
                      Back
                    </button>
                  </div>

                </div>

              )}

            </div>

          </div>

        )}


        {/* =================================================
            REMINDER NOTE MODAL
        ================================================= */}

        {showNoteForm && (

          <div
            className="dashboard-note-overlay"
            onMouseDown={(event) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                closeNoteForm();
              }

            }}
          >

            <div className="dashboard-note-modal">

              <div className="dashboard-note-modal-header">

                <div>

                  <div className="dashboard-card-kicker">
                    NEW REMINDER
                  </div>

                  <h3>
                    Add Note
                  </h3>

                </div>


                <button
                  type="button"
                  className="dashboard-note-close"
                  onClick={
                    closeNoteForm
                  }
                  aria-label="Close"
                >
                  ×
                </button>

              </div>


              <form
                onSubmit={
                  handleSaveNote
                }
              >

                <div className="dashboard-note-field">

                  <label>
                    TITLE
                  </label>

                  <input
                    type="text"
                    value={
                      noteTitle
                    }
                    maxLength="120"
                    placeholder="Judul reminder"
                    onChange={(event) =>
                      setNoteTitle(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>


                <div className="dashboard-note-field">

                  <label>
                    DESCRIPTION
                  </label>

                  <textarea
                    value={
                      noteDescription
                    }
                    maxLength="1000"
                    rows="5"
                    placeholder="Deskripsi reminder"
                    onChange={(event) =>
                      setNoteDescription(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>


                {noteError && (

                  <div className="dashboard-note-form-error">
                    {noteError}
                  </div>

                )}


                <div className="dashboard-note-form-footer">

                  <button
                    type="button"
                    className="dashboard-note-cancel"
                    onClick={
                      closeNoteForm
                    }
                    disabled={
                      savingNote
                    }
                  >
                    Cancel
                  </button>


                  <button
                    type="submit"
                    className="dashboard-note-save"
                    disabled={
                      savingNote
                    }
                  >
                    {savingNote
                      ? "Saving..."
                      : "Save Note"}
                  </button>

                </div>

              </form>

            </div>

          </div>

        )}


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="dashboard-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>

    </div>

  );

}


export default Dashboard;
