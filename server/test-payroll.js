"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Payroll_model_1 = require("./src/modules/hrms/models/Payroll.model");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect('mongodb+srv://sourabh_cu:cGvT0Y7Ehg5NMTPr@cluster0.mwqjtnf.mongodb.net/?appName=Cluster0');
        // Delete the draft payroll that was just generated with gross=0 so user can regenerate it.
        const result = yield Payroll_model_1.Payroll.deleteMany({ status: 'draft', grossSalary: 0 });
        console.log("Deleted old faulty draft payrolls:", result.deletedCount);
        process.exit(0);
    });
}
run();
