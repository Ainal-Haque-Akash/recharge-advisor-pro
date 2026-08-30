// Client-only: pulls in the trimmed Plotly bundle (scatter, bar, pie only).
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);

export default Plot;
