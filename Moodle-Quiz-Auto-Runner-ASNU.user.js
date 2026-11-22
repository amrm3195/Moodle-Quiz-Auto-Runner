// ==UserScript==
// @name         Moodle Quiz Answer Saver, Auto Filler & Auto Runner 6.5
// @namespace    http://www.asnu.edu.eg/
// @version      6.5
// @description  Save and apply Moodle quiz answers, and auto-solve selected quizzes from the grade report with a floating control panel.
// @match        http://www.asnu.edu.eg/elearning/med/grade/report/user/index.php*
// @match        http://www.asnu.edu.eg/elearning/med/mod/quiz/view.php*
// @match        http://www.asnu.edu.eg/elearning/med/mod/quiz/attempt.php*
// @match        http://www.asnu.edu.eg/elearning/med/mod/quiz/summary.php*
// @match        http://www.asnu.edu.eg/elearning/med/mod/quiz/review.php*
// @grant        none
// @copyright    Amr Mohamed Soliman
// @author       Amr Mohamed Soliman
// @license       All Rights Reserved
// @homepageURL   https://github.com/amrm3195/Moodle-Quiz-Auto-Runner
// @supportURL    https://github.com/amrm3195/Moodle-Quiz-Auto-Runner/issues
// @updateURL     https://raw.githubusercontent.com/amrm3195/Moodle-Quiz-Auto-Runner/main/Moodle-Quiz-Auto-Runner.user.js
// @downloadURL   https://raw.githubusercontent.com/amrm3195/Moodle-Quiz-Auto-Runner/main/Moodle-Quiz-Auto-Runner.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'moodle_saved_quiz_answers_v4';


    // ============================================================
    // TEXT
    // ============================================================

    function normalize(text) {

        if (!text) return '';

        return text
            .replace(/\u00A0/g, ' ')
            .replace(/\r?\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[‐-‒–—−]/g, '-')
            .trim()
            .toLowerCase();
    }


    function removeOptionLetter(text) {

        if (!text) return '';

        return text
            .replace(/^\s*[a-z]\s*[\.\)]\s*/i, '')
            .trim();
    }


    function normalizeAnswer(text) {

        return normalize(
            removeOptionLetter(text)
        );
    }


    // ============================================================
    // STORAGE
    // ============================================================

    function getDatabase() {

        try {

            return JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            ) || [];

        } catch (e) {

            console.error(
                'Could not read database:',
                e
            );

            return [];
        }
    }


    function saveDatabase(database) {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(database)
        );
    }


    // ============================================================
    // QUESTION NUMBER
    // ============================================================

    function getQuestionNumber(question) {

        const numberElement =
            question.querySelector('.qno, .no');

        if (numberElement) {

            const match =
                numberElement.textContent.match(/\d+/);

            if (match) {

                return parseInt(
                    match[0],
                    10
                );
            }
        }

        return null;
    }


    // ============================================================
    // QUESTION TEXT
    // ============================================================

    function getQuestionText(question) {

        const element =
            question.querySelector('.qtext');

        if (!element) return '';

        /*
         * Remove image alt text from normal text extraction.
         * Images are handled separately.
         */

        const clone =
            element.cloneNode(true);

        clone.querySelectorAll('img').forEach(
            img => img.remove()
        );

        return normalize(
            clone.textContent
        );
    }


    // ============================================================
    // IMAGE IDENTIFIER
    // ============================================================

    function getQuestionImages(question) {

        return Array.from(
            question.querySelectorAll(
                '.qtext img'
            )
        )
        .map(
            img => img.src
        )
        .filter(Boolean);
    }


    function getImageKey(question) {

    const images = getQuestionImages(question);

    if (!images.length) {
        return '';
    }

    return images
        .map(src => {
            try {
                const url = new URL(src);

                return url.pathname.replace(
                    /\/questiontext\/\d+\//,
                    '/questiontext/'
                );
            } catch {
                return src.trim();
            }
        })
        .join('|');
}


    // ============================================================
    // CORRECT ANSWERS FROM REVIEW
    // ============================================================

    function extractCorrectAnswers(question) {

        const rightAnswer =
            question.querySelector(
                '.rightanswer'
            );

        if (!rightAnswer) {

            return [];
        }


        let text =
            rightAnswer.textContent;


        /*
         * Remove:
         *
         * The correct answer is:
         * The correct answers are:
         */

        text = text.replace(
            /^\s*The\s+correct\s+answers?\s+(?:is|are)\s*:\s*/i,
            ''
        );


        text = text.trim();


        /*
         * True / False questions:
         *
         * The correct answer is 'True'.
         * The correct answer is 'False'.
         *
         * (no colon, answer wrapped in quotes with a final dot)
         */

        const trueFalse =
            text.match(
                /^\s*(?:The\s+correct\s+answer\s+is\s*:?\s*)?['"‘’“”]\s*(true|false)\s*['"‘’“”]\s*\.?\s*$/i
            );

        if (trueFalse) {

            return [
                trueFalse[1].toLowerCase()
            ];
        }


        if (!text) {
            return [];
        }


        /*
         * Multiple correct answers are separated by comma.
         */

        const parts =
            text
                .split(',')
                .map(
                    part =>
                        normalizeAnswer(part)
                )
                .filter(Boolean);


        return parts;
    }


    // ============================================================
    // SAVE REVIEW
    // ============================================================

    function captureAnswers() {

        const questions =
            document.querySelectorAll('.que');


        const database = [];


        let captured = 0;
        let failed = 0;


        questions.forEach(
            (question, index) => {

                const number =
                    getQuestionNumber(
                        question
                    );


                const text =
                    getQuestionText(
                        question
                    );


                const image =
                    getImageKey(
                        question
                    );


                const answers =
                    extractCorrectAnswers(
                        question
                    );


                if (
                    !answers.length
                ) {

                    failed++;

                    console.warn(
                        `Could not extract answer from question ${index + 1}`,
                        question
                    );

                    return;
                }


                database.push({

                    index:
                        index + 1,

                    number:
                        number,

                    text:
                        text,

                    image:
                        image,

                    answers:
                        answers,

                    savedAt:
                        Date.now()

                });


                captured++;

            }
        );


        saveDatabase(
            database
        );


        console.log(
            '=== MOODLE V4 DATABASE ==='
        );

        console.log(
            'Questions on page:',
            questions.length
        );

        console.log(
            'Successfully saved:',
            captured
        );

        console.log(
            'Failed:',
            failed
        );

        console.table(
            database
        );


        if (failed) {

            showMessage(
                `✓ تم حفظ ${captured} سؤال | ⚠️ فشل ${failed} سؤال — راجع Console`,
                true
            );

        } else {

            showMessage(
                `✓ تم حفظ جميع ${captured} سؤال`,
                true
            );
        }
    }


    // ============================================================
    // FIND ANSWER LABEL
    // ============================================================

    function getAnswerLabel(input) {

        let label = null;


        const labelId =
            input.getAttribute(
                'aria-labelledby'
            );


        if (labelId) {

            label =
                document.getElementById(
                    labelId
                );
        }


        if (!label) {

            label =
                input.closest(
                    '.r1, .r0'
                )?.querySelector(
                    '[data-region="answer-label"]'
                );
        }


        return label;
    }


    // ============================================================
    // IDENTIFY CURRENT QUESTION
    // ============================================================

    function findSavedQuestion(question, database) {

    const number = getQuestionNumber(question);
    const text = getQuestionText(question);
    const image = getImageKey(question);

    /*
     * IMAGE MATCH
     * Ignore attempt ID in image URL.
     */

    if (image) {

        const imageMatches = database.filter(item => {

            if (!item.image) return false;

            const savedImage = item.image
                .split('|')
                .map(src => {
                    try {
                        const url = new URL(src);

                        return url.pathname.replace(
                            /\/questiontext\/\d+\//,
                            '/questiontext/'
                        );
                    } catch {
                        return src.trim();
                    }
                })
                .join('|');

            return savedImage === image;
        });

        if (imageMatches.length === 1) {

            return {
                item: imageMatches[0],
                method: 'image'
            };
        }

        if (imageMatches.length > 1 && number !== null) {

            const numbered = imageMatches.filter(
                item => item.number === number
            );

            if (numbered.length === 1) {

                return {
                    item: numbered[0],
                    method: 'image + number'
                };
            }
        }
    }

    /*
     * TEXT + NUMBER
     */

    if (number !== null && text) {

        const matches = database.filter(
            item =>
                item.number === number &&
                item.text === text
        );

        if (matches.length === 1) {

            return {
                item: matches[0],
                method: 'number + text'
            };
        }
    }

    /*
     * TEXT ONLY
     */

    if (text) {

        const matches = database.filter(
            item => item.text === text
        );

        if (matches.length === 1) {

            return {
                item: matches[0],
                method: 'text'
            };
        }

        if (matches.length > 1) {

            return {
                ambiguous: true,
                matches: matches
            };
        }
    }

    return null;
}

    // ============================================================
    // FILL TEXT / ESSAY INPUT
    // ============================================================

   function fillTextAnswer(question, answers) {

    const input =
        question.querySelector(
            '.ablock .answer input[type="text"]'
        ) ||
        question.querySelector(
            '.ablock input[type="text"]'
        ) ||
        question.querySelector(
            'input[type="text"]'
        );

    if (!input) {
        console.warn(
            '❌ Text input not found',
            question
        );
        return false;
    }

    const answer = answers[0] || '';

    input.focus();

    input.value = answer;

    input.dispatchEvent(
        new Event('input', {
            bubbles: true
        })
    );

    input.dispatchEvent(
        new Event('change', {
            bubbles: true
        })
    );

    console.log(
        '✅ Essay answer filled:',
        answer
    );

    return true;
}

    // ============================================================
    // FILL RADIO / CHECKBOX
    // ============================================================

    function fillChoiceAnswer(
        question,
        answers
    ) {

        const inputs =
            Array.from(
                question.querySelectorAll(
                    'input[type="radio"], input[type="checkbox"]'
                )
            );


        if (!inputs.length) {

            return false;
        }


        const correctAnswers =
            answers.map(
                answer =>
                    normalizeAnswer(answer)
            );


        let matches = 0;


        /*
         * Check every option.
         */

        inputs.forEach(
            input => {

                const label =
                    getAnswerLabel(
                        input
                    );


                if (!label) {
                    return;
                }


                const option =
                    normalizeAnswer(
                        label.textContent
                    );


                if (
                    correctAnswers.includes(
                        option
                    )
                ) {

                    /*
                     * CHECKBOX:
                     * select all correct answers.
                     *
                     * RADIO:
                     * only one can actually remain selected.
                     */

                    if (!input.checked) {

                        input.click();
                    }

                    matches++;
                }

            }
        );


        /*
         * RADIO with multiple correct answers:
         *
         * The loop above may click several radios,
         * but only the last one remains selected.
         *
         * This is acceptable because the requirement is
         * to choose ANY known correct answer.
         */

        if (
            matches > 0
        ) {

            return true;
        }


        return false;
    }


    // ============================================================
    // APPLY ANSWERS
    // ============================================================

    function fillAnswers() {

        const database =
            getDatabase();


        const questions =
            document.querySelectorAll(
                '.que'
            );


        let applied = 0;
        let failed = 0;
        let ambiguous = 0;


        const failures = [];


        questions.forEach(
            (question, index) => {

                const result =
                    findSavedQuestion(
                        question,
                        database
                    );


                const number =
                    getQuestionNumber(
                        question
                    );


                if (!result) {

                    failed++;

                    failures.push({

                        question:
                            number ??
                            index + 1,

                        reason:
                            'Question not found'

                    });

                    return;
                }


                if (result.ambiguous) {

                    ambiguous++;

                    failures.push({

                        question:
                            number ??
                            index + 1,

                        reason:
                            'Duplicate question text',

                        possibleAnswers:
                            result.matches.map(
                                x =>
                                    x.answers
                            )

                    });

                    console.warn(
                        `⚠️ Q${number} was skipped because its text is duplicated.`,
                        result.matches
                    );

                    return;
                }


                const answers =
                    result.item.answers;


                /*
                 * Essay / Short Answer
                 */

                const textInputs =
                    question.querySelectorAll(
                        'input[type="text"], textarea'
                    );


                if (
                    textInputs.length > 0
                ) {

                    const success =
                        fillTextAnswer(
                            question,
                            answers
                        );


                    if (success) {

                        applied++;

                    } else {

                        failed++;

                        failures.push({

                            question:
                                number ??
                                index + 1,

                            reason:
                                'Could not fill text answer'

                        });
                    }


                    return;
                }


                /*
                 * Radio / Checkbox
                 */

                const success =
                    fillChoiceAnswer(
                        question,
                        answers
                    );


                if (success) {

                    applied++;

                } else {

                    failed++;

                    failures.push({

                        question:
                            number ??
                            index + 1,

                        reason:
                            'Correct answer not found among choices',

                        answers:
                            answers

                    });
                }

            }
        );


        // ========================================================
        // RESULT
        // ========================================================

        console.log(
            '=== MOODLE V4 RESULT ==='
        );

        console.log(
            'Questions:',
            questions.length
        );

        console.log(
            'Applied:',
            applied
        );

        console.log(
            'Failed:',
            failed
        );

        console.log(
            'Ambiguous:',
            ambiguous
        );


        if (failures.length) {

            console.warn(
                'FAILED QUESTIONS:',
                failures
            );
        }


        showMessage(

            `✓ تم تطبيق ${applied} | ⚠️ فشل ${failed} | 🔶 متكرر ${ambiguous}`,

            applied > 0
        );
    }


    // ============================================================
    // UI
    // ============================================================

    function showMessage(
        text,
        success = true
    ) {

        const old =
            document.getElementById(
                'moodle-answer-message'
            );

        if (old) old.remove();


        const message =
            document.createElement('div');


        message.id =
            'moodle-answer-message';


        message.textContent =
            text;


        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            padding: 14px 20px;
            border-radius: 8px;
            background: ${success ? '#2e7d32' : '#c62828'};
            color: white;
            font-size: 15px;
            font-weight: bold;
            box-shadow: 0 3px 12px rgba(0,0,0,.3);
        `;


        document.body.appendChild(
            message
        );


        setTimeout(
            () => {

                if (message.parentNode) {
                    message.remove();
                }

            },
            7000
        );
    }


    function createButton(
        text,
        onClick,
        bottom = 80,
        color = '#1976d2'
    ) {

        const button =
            document.createElement('button');


        button.textContent =
            text;


        button.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: ${bottom}px;
            z-index: 999999;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            background: ${color};
            color: white;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 3px 10px rgba(0,0,0,.25);
        `;


        button.addEventListener(
            'click',
            onClick
        );


        document.body.appendChild(
            button
        );
    }


    // ============================================================
    // AUTO RUNNER
    // Reads the quizzes from the grade report, then drives each
    // selected quiz page by page.
    //
    // Per quiz:
    //   a1: view.php    -> start attempt        (blind attempt)
    //   a2: attempt.php -> Finish attempt
    //       summary.php -> Submit all and finish
    //       review.php  -> save correct answers -> Finish review
    //   b1: view.php    -> start attempt        (second attempt)
    //   b2: attempt.php -> fill saved answers -> Finish attempt
    //       summary.php -> Submit all and finish
    //       review.php  -> quiz done -> next quiz
    // ============================================================

    const RUNNER_KEY = 'moodle_auto_runner_state_v1';
    const RESULT_KEY = 'moodle_auto_runner_result_v1';
    const UI_OPEN_KEY = 'moodle_auto_runner_ui_open_v1';

    const DELAY_PAGE = 1500;            // wait after a page loads
    const DELAY_STEP = 1000;            // wait between actions on one page
    const MAX_ACTIONS_PER_QUIZ = 30;    // safety limit against endless loops

    const STAGE_LABELS = {
        a1: 'بدء المحاولة الأولى',
        a2: 'المحاولة الأولى (حفظ الإجابات)',
        b1: 'بدء المحاولة الثانية',
        b2: 'المحاولة الثانية (تعبئة الإجابات)'
    };

    // Used to make the progress bar move smoothly inside one quiz.
    const STAGE_FRACTION = { a1: 0, a2: 0.25, b1: 0.5, b2: 0.75 };


    function sleep(ms) {

        return new Promise(
            resolve => setTimeout(resolve, ms)
        );
    }


    function onReady(callback) {

        if (document.readyState === 'complete') {

            callback();

        } else {

            window.addEventListener(
                'load',
                callback
            );
        }
    }


    function esc(value) {

        return String(value).replace(
            /[&<>"']/g,
            c => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[c])
        );
    }


    // ---------- runner state (localStorage, same origin) ----------

    function getState() {

        try {

            return JSON.parse(
                localStorage.getItem(RUNNER_KEY)
            );

        } catch (e) {

            return null;
        }
    }


    function saveState(state) {

        localStorage.setItem(
            RUNNER_KEY,
            JSON.stringify(state)
        );
    }


    function clearState() {

        localStorage.removeItem(RUNNER_KEY);
    }


    function getResult() {

        try {

            return JSON.parse(
                localStorage.getItem(RESULT_KEY)
            );

        } catch (e) {

            return null;
        }
    }


    function clearResult() {

        localStorage.removeItem(RESULT_KEY);
    }


    function isOnGradePage() {

        return location.pathname.includes(
            '/grade/report/user/index.php'
        );
    }


    // ---------- grade report ----------

    // Grades below this value must be solved again.
    const LOW_GRADE = 5;


    function collectQuizzes() {

        return Array.from(
            document.querySelectorAll('tbody tr')
        )
        .map(row => {

            const link =
                row.querySelector('a.gradeitemheader');

            const grade =
                row.querySelector('td.column-grade');

            if (!link || !grade) return null;

            const gradeText =
                grade.innerText.trim();

            const number =
                parseFloat(
                    gradeText.replace(',', '.')
                );

            let status = 'done';

            if (gradeText === '-') {

                status = 'unsolved';

            } else if (!isNaN(number) && number < LOW_GRADE) {

                status = 'low';
            }

            return {
                name: link.innerText.trim(),
                url: link.href,
                grade: gradeText,
                solved: gradeText !== '-',
                status: status
            };
        })
        .filter(
            q => q && q.url.includes('/mod/quiz/')
        ).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }


    // ---------- start / stop / finish ----------

    function startRunner(quizzes) {

        if (!quizzes.length) return;

        console.log(
            'Quizzes to solve: ' + quizzes.length,
            quizzes
        );

        clearResult();

        saveState({
            running: true,
            quizzes: quizzes.map(
                q => ({ name: q.name, url: q.url })
            ),
            index: 0,
            stage: 'a1',
            actions: 0,
            problems: [],
            gradeUrl: location.href
        });

        location.href =
            quizzes[0].url;
    }


    function stopRunner(reason) {

        const state = getState();

        if (state) {

            state.running = false;

            state.stopReason =
                typeof reason === 'string'
                    ? reason
                    : 'تم الإيقاف يدوياً';

            saveState(state);
        }

        renderUI();
    }


    function finishRunner(state) {

        const problems =
            (state && state.problems) || [];

        const total =
            state ? state.quizzes.length : 0;

        localStorage.setItem(
            RESULT_KEY,
            JSON.stringify({
                total: total,
                problems: problems,
                finishedAt: Date.now()
            })
        );

        clearState();

        console.log('All quizzes done');

        if (problems.length) {

            console.table(problems);
        }

        if (state && state.gradeUrl) {

            location.href =
                state.gradeUrl;

        } else {

            renderUI();
        }
    }


    function nextQuiz(state, problem) {

        const quiz =
            state.quizzes[state.index];

        if (problem) {

            state.problems.push({
                quiz: quiz ? quiz.name : '?',
                problem: problem
            });

            console.warn(
                `Quiz ${state.index + 1}: ${problem}`
            );

        } else {

            console.log(
                `Finished quiz ${state.index + 1}, moving to the next one`
            );
        }

        state.index++;
        state.stage = 'a1';
        state.actions = 0;

        if (state.index >= state.quizzes.length) {

            finishRunner(state);
            return;
        }

        saveState(state);

        location.href =
            state.quizzes[state.index].url;
    }


    // ---------- page helpers ----------

    function clickPrimary() {

        const button =
            Array.from(
                document.querySelectorAll('.btn-primary')
            ).find(
                b => !b.closest('.modal')
            );

        if (!button) return false;

        button.click();

        return true;
    }


    async function confirmModal(timeout = 4000) {

        const end =
            Date.now() + timeout;

        while (Date.now() < end) {

            const button =
                document.querySelector(
                    '.modal.show .btn-primary, ' +
                    '.modal.in .btn-primary, ' +
                    '.moodle-dialogue-confirm .btn-primary, ' +
                    '.modal [data-action="save"]'
                );

            if (button) {

                button.click();

                return true;
            }

            await sleep(250);
        }

        return false;
    }


    function clickNextNav() {

        const button =
            document.getElementById(
                'mod_quiz-next-nav'
            );

        if (!button) return false;

        button.click();

        return true;
    }


    function goToFinishReview(state) {

        const link =
            Array.from(
                document.querySelectorAll('a')
            ).find(
                a => /^\s*finish review\s*$/i.test(
                    a.textContent
                )
            );

        if (link) {

            link.click();

        } else {

            location.href =
                state.quizzes[state.index].url;
        }
    }


    // ---------- the step handler (runs once per page load) ----------

    async function runStep() {

        let state = getState();

        if (!state || !state.running) return;

        if (!state.quizzes[state.index]) {

            finishRunner(state);
            return;
        }

        state.actions =
            (state.actions || 0) + 1;

        saveState(state);

        if (state.actions > MAX_ACTIONS_PER_QUIZ) {

            nextQuiz(
                state,
                'Too many steps - quiz skipped'
            );

            return;
        }

        await sleep(DELAY_PAGE);

        // The stop button may have been pressed meanwhile.
        state = getState();

        if (!state || !state.running) return;

        const path = location.pathname;
        const stage = state.stage;


        // ----- quiz page (view.php) -----

        if (path.includes('/view.php')) {

            if (stage === 'a1' || stage === 'b1') {

                state.stage =
                    stage === 'a1' ? 'a2' : 'b2';

                saveState(state);

                if (!clickPrimary()) {

                    nextQuiz(
                        state,
                        stage === 'a1'
                            ? 'Start button not found'
                            : 'No second attempt available'
                    );

                    return;
                }

                await confirmModal();

                return;
            }

            if (stage === 'b2') {

                nextQuiz(state, null);

                return;
            }

            if (stage === 'a2') {

                nextQuiz(
                    state,
                    'Review not available - answers were not saved'
                );

                return;
            }

            return;
        }


        // ----- attempt page (attempt.php) -----

        if (path.includes('/attempt.php')) {

            if (stage === 'b2') {

                fillAnswers();

                await sleep(DELAY_STEP * 1.5);

            } else if (stage === 'a2') {

                await sleep(DELAY_STEP);

            } else {

                return;
            }

            const current = getState();

            if (!current || !current.running) return;

            if (!clickNextNav()) {

                stopRunner(
                    'زر Next / Finish attempt غير موجود'
                );
            }

            return;
        }


        // ----- summary page (summary.php) -----

        if (path.includes('/summary.php')) {

            if (stage !== 'a2' && stage !== 'b2') return;

            if (!clickPrimary()) {

                stopRunner(
                    'زر Submit all and finish غير موجود'
                );

                return;
            }

            await confirmModal();

            return;
        }


        // ----- review page (review.php) -----

        if (path.includes('/review.php')) {

            if (stage === 'a2') {

                // Make sure every question is on the page.
                if (!/showall=1/.test(location.search)) {

                    const all =
                        document.querySelector(
                            'a[href*="showall=1"]'
                        );

                    if (all) {

                        location.href = all.href;

                        return;
                    }
                }

                captureAnswers();

                state.stage = 'b1';

                saveState(state);

                await sleep(DELAY_STEP);

                const current = getState();

                if (!current || !current.running) return;

                goToFinishReview(state);

                return;
            }

            if (stage === 'b2') {

                nextQuiz(state, null);

                return;
            }
        }
    }


    // ============================================================
    // FLOATING UI (Shadow DOM, so Moodle's CSS cannot affect it)
    // ============================================================

    const UI_CSS = `
        :host { all: initial; }

        * {
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
        }

        .wrap {
            position: fixed;
            left: 20px;
            bottom: 20px;
            z-index: 2147483000;
            direction: ltr;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
        }

        .panel {
            direction: rtl;
            width: 330px;
            max-width: calc(100vw - 40px);
            max-height: calc(100vh - 110px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: #ffffff;
            color: #1f2933;
            border-radius: 16px;
            border: 1px solid #e4e7eb;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .22);
        }

        .panel.hidden { display: none; }

        .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            color: #fff;
            background: linear-gradient(135deg, #1976d2, #2e7d32);
        }

        .title { font-size: 15px; font-weight: 700; }
        .sub { font-size: 11px; opacity: .85; margin-top: 2px; }

        .min {
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, .22);
            color: #fff;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
        }

        .min:hover { background: rgba(255, 255, 255, .35); }

        .body {
            padding: 14px 16px 16px;
            overflow-y: auto;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
        }

        .stat {
            border-radius: 12px;
            padding: 10px 6px;
            text-align: center;
        }

        .stat b {
            display: block;
            font-size: 20px;
            line-height: 1.15;
        }

        .stat span { font-size: 11px; }

        .s-total { background: #e8f0fe; color: #1a56b0; }
        .s-done  { background: #e6f4ea; color: #1e7e34; }
        .s-todo  { background: #fff3e0; color: #c26a00; }
        .s-low   { background: #fdecea; color: #c62828; }

        .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
        }

        .chip {
            padding: 4px 10px;
            border: 1px solid #d5dbe1;
            border-radius: 999px;
            background: #fff;
            color: #3e4c59;
            font-size: 12px;
            cursor: pointer;
        }

        .chip:hover { background: #f0f4f8; }

        .chip.on {
            border-color: #1976d2;
            background: #1976d2;
            color: #fff;
        }

        .item.low { background: #fdecea; }
        .item.low:hover { background: #fbdcd8; }

        .tag {
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
        }

        .item.unsolved .tag { color: #c26a00; }
        .item.low .tag      { color: #c62828; }
        .item.done .tag     { color: #1e7e34; }

        .hint {
            margin-top: 8px;
            font-size: 11.5px;
            color: #c62828;
        }

        .row-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 600;
        }

        .selall {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }

        .count {
            font-size: 12px;
            font-weight: 600;
            color: #52606d;
            background: #f0f2f5;
            padding: 2px 10px;
            border-radius: 999px;
        }

        .list {
            border: 1px solid #e4e7eb;
            border-radius: 12px;
            max-height: 210px;
            overflow-y: auto;
        }

        .item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 12px;
            font-size: 13px;
            border-bottom: 1px solid #f0f2f5;
            cursor: pointer;
        }

        .item:last-child { border-bottom: none; }
        .item:hover { background: #f7f9fb; }

        .name {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        input[type=checkbox] {
            width: 16px;
            height: 16px;
            margin: 0;
            accent-color: #1976d2;
            cursor: pointer;
        }

        .btn {
            width: 100%;
            margin-top: 14px;
            padding: 12px;
            border: none;
            border-radius: 12px;
            color: #fff;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
        }

        .btn.go   { background: #2e7d32; }
        .btn.stop { background: #d32f2f; }
        .btn.back { background: #1976d2; }
        .btn:disabled { background: #b8c2cc; cursor: not-allowed; }

        .status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 14px;
            font-weight: 700;
        }

        .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #2e7d32;
            animation: pulse 1.2s infinite;
        }

        .status.stopped .dot {
            background: #d32f2f;
            animation: none;
        }

        @keyframes pulse {
            0%   { box-shadow: 0 0 0 0 rgba(46, 125, 50, .5); }
            70%  { box-shadow: 0 0 0 8px rgba(46, 125, 50, 0); }
            100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
        }

        .bar {
            height: 12px;
            overflow: hidden;
            background: #e8ecf0;
            border-radius: 999px;
        }

        .bar i {
            display: block;
            height: 100%;
            background: linear-gradient(90deg, #43a047, #66bb6a);
            border-radius: 999px;
            transition: width .4s ease;
        }

        .barinfo {
            display: flex;
            justify-content: space-between;
            margin: 8px 0 12px;
            font-size: 13px;
            color: #52606d;
        }

        .now {
            padding: 10px 12px;
            margin-bottom: 12px;
            background: #f5f8fb;
            border-radius: 12px;
        }

        .now small { color: #7b8794; font-size: 11px; }

        .nowname {
            margin: 2px 0;
            font-size: 13px;
            font-weight: 600;
        }

        .step { font-size: 12px; color: #1976d2; }

        .list.small { max-height: 150px; }

        .li {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            font-size: 12.5px;
            border-bottom: 1px solid #f0f2f5;
        }

        .li:last-child { border-bottom: none; }

        .li .ic {
            width: 18px;
            text-align: center;
            font-weight: 700;
        }

        .li.done .ic { color: #2e7d32; }
        .li.warn .ic { color: #c26a00; }
        .li.now  { background: #eef5fd; font-weight: 600; }
        .li.now .ic { color: #1976d2; }
        .li.todo { color: #7b8794; }

        .banner {
            position: relative;
            padding: 10px 12px;
            margin-bottom: 14px;
            font-size: 13px;
            border-radius: 12px;
            background: #e6f4ea;
            color: #1e7e34;
        }

        .banner.warn {
            background: #fff3e0;
            color: #a35a00;
        }

        .banner b { display: block; margin-bottom: 2px; }

        .banner .x {
            position: absolute;
            top: 6px;
            left: 8px;
            border: none;
            background: none;
            color: inherit;
            font-size: 16px;
            cursor: pointer;
        }

        .probs {
            max-height: 90px;
            margin-top: 6px;
            overflow-y: auto;
            font-size: 12px;
        }

        .empty {
            padding: 18px 10px;
            text-align: center;
            font-size: 13px;
            color: #7b8794;
        }

        .reason {
            margin-bottom: 12px;
            font-size: 12.5px;
            color: #7b8794;
        }

        .fab {
            --p: 100;
            --c: #1976d2;
            width: 56px;
            height: 56px;
            padding: 0;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            background: conic-gradient(var(--c) calc(var(--p) * 1%), #d5dbe1 0);
            box-shadow: 0 6px 18px rgba(0, 0, 0, .28);
            transition: transform .15s ease;
        }

        .fab:hover { transform: scale(1.06); }

        .fab .in {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            background: var(--c);
        }
    `;

    const FAB_ICON =
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">' +
        '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>';


    let uiHost = null;
    let uiRoot = null;
    let gradeQuizzes = null;      // all quizzes read from the grade report
    let uiSelected = new Set();   // selected indexes inside gradeQuizzes


    function isUiOpen() {

        const value =
            localStorage.getItem(UI_OPEN_KEY);

        return value === null ? true : value === '1';
    }


    function applyUiOpen() {

        uiRoot.getElementById('panel')
            .classList
            .toggle('hidden', !isUiOpen());
    }


    function toggleUi() {

        localStorage.setItem(
            UI_OPEN_KEY,
            isUiOpen() ? '0' : '1'
        );

        applyUiOpen();
    }


    function createUI() {

        if (uiHost) return;

        uiHost =
            document.createElement('div');

        uiHost.id =
            'moodle-runner-ui';

        document.body.appendChild(uiHost);

        uiRoot =
            uiHost.attachShadow({ mode: 'open' });

        uiRoot.innerHTML = `
            <style>${UI_CSS}</style>
            <div class="wrap">
                <div class="panel" id="panel">
                    <div class="head">
                        <div>
                            <div class="title">Quiz Auto Solver v6.5</div>
                            <div class="sub">Developed by Amr Mohamed Soliman</div>
                        </div>
                        <button class="min" id="min" title="إخفاء">&minus;</button>
                    </div>
                    <div class="body" id="body"></div>
                </div>
                <button class="fab" id="fab" title="Quiz Auto Solver">
                    <span class="in" id="fabin"></span>
                </button>
            </div>
        `;

        uiRoot.getElementById('fab')
            .addEventListener('click', toggleUi);

        uiRoot.getElementById('min')
            .addEventListener('click', toggleUi);
    }


    function removeUI() {

        if (uiHost) {

            uiHost.remove();

            uiHost = null;
            uiRoot = null;
        }
    }


    function progressPercent(state) {

        const total =
            state.quizzes.length;

        if (!total || state.index >= total) return 100;

        return Math.round(
            (
                (state.index + (STAGE_FRACTION[state.stage] || 0))
                / total
            ) * 100
        );
    }


    function updateFab(mode, percent) {

        const fab =
            uiRoot.getElementById('fab');

        const inner =
            uiRoot.getElementById('fabin');

        if (mode === 'running') {

            fab.style.setProperty('--p', percent);
            fab.style.setProperty('--c', '#2e7d32');

            inner.textContent = percent + '%';

        } else if (mode === 'stopped') {

            fab.style.setProperty('--p', 100);
            fab.style.setProperty('--c', '#d32f2f');

            inner.textContent = '!';

        } else {

            fab.style.setProperty('--p', 100);
            fab.style.setProperty('--c', '#1976d2');

            inner.innerHTML = FAB_ICON;
        }
    }


    function runList(state) {

        const failed =
            new Set(
                (state.problems || []).map(p => p.quiz)
            );

        return state.quizzes.map((quiz, i) => {

            let cls = 'todo';
            let icon = '&bull;';

            if (i < state.index) {

                if (failed.has(quiz.name)) {

                    cls = 'warn';
                    icon = '!';

                } else {

                    cls = 'done';
                    icon = '&#10003;';
                }

            } else if (i === state.index) {

                cls = 'now';
                icon = '&#9654;';
            }

            return `
                <div class="li ${cls}">
                    <span class="ic">${icon}</span>
                    <span class="name" dir="auto" title="${esc(quiz.name)}">${esc(quiz.name)}</span>
                </div>
            `;

        }).join('');
    }


    function renderRunning(state) {

        const percent =
            progressPercent(state);

        const total =
            state.quizzes.length;

        const quiz =
            state.quizzes[state.index];

        uiRoot.getElementById('body').innerHTML = `
            <div class="status"><span class="dot"></span>جاري التشغيل التلقائي</div>
            <div class="bar"><i style="width:${percent}%"></i></div>
            <div class="barinfo">
                <span>اكتمل <b>${state.index}</b> من <b>${total}</b> كويز</span>
                <span>${percent}%</span>
            </div>
            <div class="now">
                <small>الكويز الحالي</small>
                <div class="nowname" dir="auto">${esc(quiz ? quiz.name : '')}</div>
                <div class="step">${esc(STAGE_LABELS[state.stage] || state.stage)}</div>
            </div>
            <div class="list small">${runList(state)}</div>
            <button class="btn stop" id="stopbtn">إيقاف التشغيل التلقائي</button>
        `;

        uiRoot.getElementById('stopbtn')
            .addEventListener('click', () => stopRunner());

        updateFab('running', percent);
    }


    function renderStopped(state) {

        const total =
            state.quizzes.length;

        uiRoot.getElementById('body').innerHTML = `
            <div class="status stopped"><span class="dot"></span>تم الإيقاف</div>
            <div class="reason">${esc(state.stopReason || '')}</div>
            <div class="barinfo">
                <span>اكتمل <b>${Math.min(state.index, total)}</b> من <b>${total}</b> كويز</span>
            </div>
            <div class="list small">${runList(state)}</div>
            <button class="btn back" id="backbtn">العودة لصفحة الدرجات</button>
        `;

        uiRoot.getElementById('backbtn')
            .addEventListener('click', () => {

                const url =
                    state.gradeUrl || location.href;

                clearState();

                location.href = url;
            });

        updateFab('stopped', 100);
    }


    function presetSet(name) {

        const set = new Set();

        gradeQuizzes.forEach((quiz, i) => {

            if (
                name === 'all' ||
                (name === 'unsolved' && quiz.status === 'unsolved') ||
                (name === 'need' && quiz.status !== 'done')
            ) {

                set.add(i);
            }
        });

        return set;
    }


    function sameSet(a, b) {

        return (
            a.size === b.size &&
            Array.from(a).every(i => b.has(i))
        );
    }


    function renderIdle() {

        if (!gradeQuizzes) {

            gradeQuizzes = collectQuizzes();

            // Default: unsolved quizzes + quizzes below the pass grade.
            uiSelected = presetSet('need');
        }

        const total =
            gradeQuizzes.length;

        const unsolved =
            gradeQuizzes.filter(q => q.status === 'unsolved').length;

        const low =
            gradeQuizzes.filter(q => q.status === 'low').length;

        const done =
            total - unsolved - low;

        const result =
            getResult();

        let banner = '';

        if (result) {

            const problems =
                result.problems || [];

            banner = `
                <div class="banner ${problems.length ? 'warn' : ''}">
                    <button class="x" id="bannerx" title="إغلاق">&times;</button>
                    <b>تم الانتهاء من ${result.total} كويز</b>
                    ${problems.length
                        ? `ملاحظات: ${problems.length}
                           <div class="probs">${problems.map(
                               p => `<div dir="auto">${esc(p.quiz)}: ${esc(p.problem)}</div>`
                           ).join('')}</div>`
                        : 'بدون أي مشاكل'}
                </div>
            `;
        }

        const items =
            gradeQuizzes.map((quiz, i) => `
                <label class="item ${quiz.status}">
                    <input type="checkbox" data-i="${i}">
                    <span class="name" dir="auto" title="${esc(quiz.name)}">${esc(quiz.name)}</span>
                    <span class="tag">${quiz.status === 'unsolved' ? 'غير محلول' : esc(quiz.grade)}</span>
                </label>
            `).join('');

        uiRoot.getElementById('body').innerHTML = `
            <div class="stats">
                <div class="stat s-total"><b>${total}</b><span>الإجمالي</span></div>
                <div class="stat s-done"><b>${done}</b><span>تم حلها</span></div>
                <div class="stat s-todo"><b>${unsolved}</b><span>غير محلولة</span></div>
                <div class="stat s-low"><b>${low}</b><span>أقل من ${LOW_GRADE}</span></div>
            </div>
            ${banner}
            ${total ? `
                <div class="row-head">
                    <span>اختيار الكويزات</span>
                    <span class="count" id="cnt"></span>
                </div>
                <div class="chips">
                    <button class="chip" data-p="all">الكل</button>
                    <button class="chip" data-p="unsolved">غير المحلولة فقط</button>
                    <button class="chip" data-p="need">المطلوب حلها</button>
                    <button class="chip" data-p="none">مسح</button>
                </div>
                <div class="list" id="list">${items}</div>
                ${low ? `<div class="hint">اللون الأحمر = درجته أقل من ${LOW_GRADE}.00 ولازم يتحل من جديد</div>` : ''}
                <button class="btn go" id="gobtn"></button>
            ` : `
                <div class="empty">لا توجد كويزات في الصفحة</div>
            `}
        `;

        if (result) {

            uiRoot.getElementById('bannerx')
                .addEventListener('click', () => {

                    clearResult();

                    renderUI();
                });
        }

        if (total) {

            const list =
                uiRoot.getElementById('list');

            const goButton =
                uiRoot.getElementById('gobtn');

            const chips =
                Array.from(
                    uiRoot.querySelectorAll('.chip')
                );

            const sync = () => {

                const n = uiSelected.size;

                list.querySelectorAll(
                    'input[type="checkbox"]'
                ).forEach(
                    box => {
                        box.checked =
                            uiSelected.has(
                                parseInt(box.dataset.i, 10)
                            );
                    }
                );

                chips.forEach(chip => {

                    const p = chip.dataset.p;

                    const target =
                        p === 'none'
                            ? new Set()
                            : presetSet(p);

                    chip.classList.toggle(
                        'on',
                        sameSet(target, uiSelected)
                    );
                });

                uiRoot.getElementById('cnt')
                    .textContent = `${n} / ${total}`;

                goButton.disabled =
                    n === 0;

                goButton.textContent =
                    n === total
                        ? `ابدأ حل الكل (${n})`
                        : `ابدأ حل المحدد (${n})`;
            };

            list.addEventListener(
                'change',
                event => {

                    const box = event.target;

                    if (!box.dataset || box.dataset.i === undefined) return;

                    const i = parseInt(box.dataset.i, 10);

                    if (box.checked) {

                        uiSelected.add(i);

                    } else {

                        uiSelected.delete(i);
                    }

                    sync();
                }
            );

            chips.forEach(chip => {

                chip.addEventListener(
                    'click',
                    () => {

                        uiSelected =
                            chip.dataset.p === 'none'
                                ? new Set()
                                : presetSet(chip.dataset.p);

                        sync();
                    }
                );
            });

            goButton.addEventListener(
                'click',
                () => {

                    startRunner(
                        gradeQuizzes.filter(
                            (q, i) => uiSelected.has(i)
                        )
                    );
                }
            );

            sync();
        }

        updateFab('idle');
    }


    function renderUI() {

        const state = getState();

        // Quiz pages show the panel only while a run exists.
        if (!state && !isOnGradePage()) {

            removeUI();

            return;
        }

        createUI();

        if (state && state.running) {

            renderRunning(state);

        } else if (state) {

            renderStopped(state);

        } else {

            renderIdle();
        }

        applyUiOpen();
    }


    // ============================================================
    // START
    // ============================================================

    onReady(() => {

        renderUI();

        // Grade report: the panel is all that is needed.
        if (isOnGradePage()) return;


        // Quiz pages: manual buttons stay as before.
        if (location.pathname.includes('/review.php')) {

            createButton(
                '💾 حفظ الإجابات الصحيحة',
                captureAnswers
            );
        }


        if (location.pathname.includes('/attempt.php')) {

            setTimeout(
                () => {

                    createButton(
                        '✓ تحديد الإجابات المحفوظة',
                        fillAnswers
                    );

                },
                1000
            );
        }


        // Automatic mode.
        runStep();
    });

})();
