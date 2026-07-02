**📈 ForecastIQ – Sales Forecasting & Business Intelligence Platform**

ForecastIQ is a full‑stack web platform designed to import, clean, analyze and forecast sales data using multiple Machine Learning models, anomaly detection and role‑based dashboards.

This project was developed as an end‑of‑year academic project (PFA) at EMSI, by BAKHOUTI Malak and EL-GHAZOUI Mohamed, supervised by **Mme Aarich Mounia**.

**🚀 Main Features**

📊 Analyste (Student/Main user)
* Create account and log in securely (JWT)
* Import sales files (CSV, XLSX, XLS) with column mapping preview
* Launch forecasts with configurable granularity and horizon
* View dashboard: overview, forecasts, anomalies, categories, ML models

🧑‍💼 Manager
* Review imported datasets
* Add annotations on results
* Validate certain results

🛡️ Admin
* Manage users (list, activate/suspend, change role)
* View global platform statistics
* Access activity logs
* Track important system operations

**🏗️ Architecture Overview**

ForecastIQ uses a multi-layer architecture, each layer for a specific responsibility:

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js / React.js | User interface, dashboard, charts |
| Backend | Flask (Python) | REST API, authentication, orchestration |
| ML Engine | Scikit-learn, Statsmodels | Forecasting models & metrics |
| Database | PostgreSQL | Users, datasets, forecasts, activity logs |

**🗄️ Forecasting Models – Usage Summary**

**Linear Regression**
* Baseline trend estimation

**Polynomial Regression**
* Captures non-linear trends

**Random Forest**
* Ensemble tree-based regression for complex patterns

**ARIMA**
* Classical time-series forecasting

**Ensemble Model**
* Combines all models above
* Excludes any model scoring below a 70% reliability threshold on the test set
* Compared using MAE, RMSE and R²

**🔄 Key Usage Scenarios**

1️⃣ File import & preprocessing
1. User uploads a CSV/XLSX sales file
2. System detects date, numeric and category columns
3. User validates the column mapping
4. Pandas cleans the data (dates, duplicates, missing values)
5. Dataset saved to PostgreSQL

2️⃣ Forecast generation
1. User selects granularity (day/week/month) and horizon
2. Multiple ML models trained in parallel
3. Models below 70% reliability excluded from ensemble
4. Metrics computed (MAE, RMSE, R²)
5. Dashboard updated with forecasts and model comparison

3️⃣ Anomaly detection
1. Historical sales analyzed statistically
2. Atypical values (spikes, drops) identified
3. Anomalies displayed with date, value and deviation

**▶️ Run the Project**

Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
flask run
```

Frontend
```bash
cd frontend
npm install
npm run dev
```

**🔮 Future Improvements**
* Additional forecasting models (Prophet, LSTM)
* Real-time collaborative annotations for managers
* Export of forecasts and reports (PDF/Excel)
* SaaS multi-tenant deployment

**🎤 Conclusion**

ForecastIQ illustrates a complete sales forecasting platform, combining a Next.js/Flask full-stack architecture with a multi-model Machine Learning engine (Linear Regression, Polynomial Regression, Random Forest, ARIMA and ensemble learning), anomaly detection, and role-based dashboards to support data-driven business decisions.
