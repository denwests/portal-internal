export const PLUNO_PRINT_CSS = `
  body {
    margin: 0;
    color: #202022;
    background: #fff;
    font-family: Inter, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 10px;
    line-height: 1.5;
  }

  .header {
    min-height: 88px;
    margin: 0 0 20px;
    padding: 16px 18px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    color: #f4f4f4;
    background: #1a1a1c;
    border: 0;
    border-bottom: 3px solid #707074;
  }

  .brand {
    color: #aaaab0;
    font-size: 8px;
    line-height: 1;
    font-weight: 600;
    letter-spacing: 1.8px;
  }

  .subtitle {
    margin-top: 5px;
    color: #85858a;
    font-size: 7px;
    letter-spacing: 1.4px;
  }

  .document-type,
  .header h1 {
    margin: 10px 0 0;
    color: #f5f5f5;
    font-size: 20px;
    line-height: 1.1;
    font-weight: 500;
    letter-spacing: -.3px;
  }

  .document-period,
  .period,
  .header-right .value {
    color: #d0d0d2;
    font-size: 9px;
  }

  .header-right { color: #fff; text-align: right; }
  .header-right .label { color: #85858a; font-size: 7px; letter-spacing: 1.3px; }

  .intro { margin: 0 0 18px; color: #6e6e72; font-size: 9px; }
  .section { margin-top: 22px; break-inside: avoid; }
  .section-title {
    margin-bottom: 10px;
    padding-bottom: 7px;
    color: #303034;
    border-bottom: 1px solid #cfcfd2;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th {
    padding: 8px 7px;
    color: #f2f2f2;
    background: #232326;
    border: 0;
    text-align: left;
    font-size: 7px;
    font-weight: 500;
    letter-spacing: .8px;
    text-transform: uppercase;
  }
  td { padding: 8px 7px; color: #2f2f32; border-bottom: 1px solid #dfdfe1; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f5f5f6; }

  .summary { margin-top: 12px; border-top: 1px solid #2d2d30; }
  .summary-row { border-color: #d9d9dc; }
  .summary-row.highlight { color: #fff; background: #29292c; padding: 10px 12px; }

  .total { border-top: 1px solid #29292c; }
  .total-label { color: #77777c; }
  .total-value { color: #242427; font-weight: 500; }

  .footer {
    margin-top: 30px;
    padding-top: 9px;
    display: flex;
    justify-content: space-between;
    color: #85858a;
    border-top: 1px solid #d3d3d6;
    font-size: 7px;
    letter-spacing: .7px;
  }
  .footer strong { color: #404044; font-weight: 600; }
`;
