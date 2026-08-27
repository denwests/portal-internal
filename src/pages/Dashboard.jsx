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
    bookings,
    setBookings,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


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
     YEAR OPTIONS
  ======================================================= */

  const currentYear =
    today.getFullYear();


  const yearOptions = [];


  for (
    let year =
      currentYear - 5;

    year <=
    currentYear + 5;

    year++
  ) {

    yearOptions.push(
      year
    );

  }


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
            "id, total, date"
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


      /* ===================================================
         SELECTED MONTH CUSTOMERS
      =================================================== */

      const selectedMonthCustomers =
        customers.filter(
          (
            customer
          ) => {

            if (
              !customer.date
            ) {
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
         REVENUE
      =================================================== */

      const selectedRevenue =
        selectedMonthCustomers.reduce(
          (
            sum,
            customer
          ) => {

            return (
              sum +
              Number(
                customer.total ||
                0
              )
            );

          },
          0
        );


      setTotalRevenue(
        selectedRevenue
      );


      /* ===================================================
         MONTHLY REVENUE
      =================================================== */

      const monthly =
        Array(12).fill(0);


      customers.forEach(
        (
          customer
        ) => {

          if (
            !customer.date
          ) {
            return;
          }


          const customerDate =
            new Date(
              `${customer.date}T00:00:00`
            );


          const customerMonth =
            customerDate.getMonth();


          monthly[
            customerMonth
          ] += Number(
            customer.total ||
            0
          );

        }
      );


      setMonthlyRevenue(
        monthly
      );


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


      setBookings(
        bookingList
      );


      /* ===================================================
         UPCOMING BOOKINGS
      =================================================== */

      const now =
        new Date();


      const selectedMonthBookings =
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
    selectedMonth,
    selectedYear,
  ]);


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
     PERFORMANCE FILTER
  ======================================================= */

  const handlePerformanceMonthChange =
    (
      event
    ) => {

      setSelectedMonth(
        Number(
          event.target.value
        )
      );

    };


  const handlePerformanceYearChange =
    (
      event
    ) => {

      setSelectedYear(
        Number(
          event.target.value
        )
      );

    };


  /* =======================================================
     MAX REVENUE
  ======================================================= */

  const maxRevenue =
    Math.max(
      ...monthlyRevenue,
      1
    );


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

        <header className="dashboard-topbar">

          <div>

            <div className="dashboard-eyebrow">
              PLUNO STUDIO · INTERNAL PORTAL
            </div>

            <h1>
              Dashboard
            </h1>

            <p>
              Overview of your studio activity.
            </p>

          </div>


          <div className="dashboard-status">

            <span></span>

            Studio Online

          </div>

        </header>


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

              <select
                value={
                  selectedMonth
                }
                onChange={
                  handlePerformanceMonthChange
                }
              >

                {monthNames.map(
                  (
                    month,
                    index
                  ) => (

                    <option
                      value={index}
                      key={month}
                    >
                      {month}
                    </option>

                  )
                )}

              </select>


              <select
                value={
                  selectedYear
                }
                onChange={
                  handlePerformanceYearChange
                }
              >

                {yearOptions.map(
                  (
                    year
                  ) => (

                    <option
                      value={year}
                      key={year}
                    >
                      {year}
                    </option>

                  )
                )}

              </select>

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


              <div className="revenue-chart">

                {monthlyRevenue.map(
                  (
                    value,
                    index
                  ) => {

                    const height =
                      (
                        value /
                        maxRevenue
                      ) *
                      100;


                    return (

                      <div
                        className="revenue-column"
                        key={index}
                      >

                        <div className="revenue-bar-area">

                          <div
                            className="revenue-bar"
                            style={{
                              height:
                                `${Math.max(
                                  height,
                                  3
                                )}%`,
                            }}
                          />

                        </div>


                        <div className="revenue-month">

                          {monthNames[
                            index
                          ]
                            .substring(
                              0,
                              3
                            )
                            .toUpperCase()}

                        </div>

                      </div>

                    );

                  }
                )}

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
                        }`}
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