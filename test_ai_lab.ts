import { generateAdVariants } from "./src/app/actions/ai-lab.actions";

async function run() {
    const res = await generateAdVariants("30% off a premium yoga subscription for new signups");
    console.log(res);
}
run();
