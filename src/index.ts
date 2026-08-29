import { config } from "./config/env";
import { app } from "./http/app";

app.listen(config.port);
